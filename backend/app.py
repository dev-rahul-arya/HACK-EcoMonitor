"""
EcoMonitor Backend — Flask API
All Gemini AI calls are routed through this server.
Data processing happens here with pandas; only compact summaries are sent to Gemini.
"""

import os
import json
import hashlib
import time
import threading
from datetime import datetime

import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_caching import Cache
from dotenv import load_dotenv

from google import genai
from google.genai import types

# Load .env from project root (one shared env file)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)

CACHE_TTL = int(os.getenv("CACHE_TTL", 1800))  # 30 min default (was 5 min)
CLIMATE_CACHE_TTL = int(os.getenv("CLIMATE_CACHE_TTL", 86400))  # 24h for static climate data
cache = Cache(app, config={"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": CACHE_TTL})

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_MODEL_LITE = os.getenv("GEMINI_MODEL_LITE", "gemini-2.0-flash-lite")

_genai_client = None
if GEMINI_API_KEY:
    _genai_client = genai.Client(api_key=GEMINI_API_KEY)

# Simple per-minute rate limiter to avoid burst 429s
_rate_lock = threading.Lock()
_rate_calls: list[float] = []  # timestamps of recent calls
MAX_CALLS_PER_MINUTE = int(os.getenv("MAX_GEMINI_RPM", 10))

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _cache_key(prefix: str, data: dict) -> str:
    """Deterministic cache key from request payload."""
    raw = json.dumps(data, sort_keys=True, default=str)
    return f"{prefix}:{hashlib.md5(raw.encode()).hexdigest()}"


def _rate_limit_wait():
    """Block until we're under the per-minute rate limit."""
    with _rate_lock:
        now = time.time()
        # Purge calls older than 60s
        _rate_calls[:] = [t for t in _rate_calls if now - t < 60]
        if len(_rate_calls) >= MAX_CALLS_PER_MINUTE:
            wait = 60 - (now - _rate_calls[0]) + 0.5
            if wait > 0:
                time.sleep(wait)
        _rate_calls.append(time.time())


def _call_gemini(
    prompt: str,
    *,
    json_mode: bool = False,
    max_tokens: int = 1024,
    lite: bool = False,
    retries: int = 3,
) -> str | dict:
    """Call Gemini with retry + backoff on 429. Use lite=True for simple tasks."""
    if not _genai_client:
        raise RuntimeError("Gemini API key not configured")

    prompt = _truncate_prompt(prompt)
    model = GEMINI_MODEL_LITE if lite else GEMINI_MODEL

    for attempt in range(retries):
        _rate_limit_wait()
        try:
            response = _genai_client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.4 if json_mode else 0.7,
                    max_output_tokens=max_tokens,
                ),
            )
            text = response.text.strip()
            if json_mode:
                cleaned = text.replace("```json", "").replace("```", "").strip()
                first = cleaned.find("{")
                last = cleaned.rfind("}")
                if first != -1 and last > first:
                    cleaned = cleaned[first : last + 1]
                if first == -1:
                    first_arr = cleaned.find("[")
                    last_arr = cleaned.rfind("]")
                    if first_arr != -1 and last_arr > first_arr:
                        cleaned = cleaned[first_arr : last_arr + 1]
                return json.loads(cleaned)
            return text
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                wait = min(2 ** attempt * 15, 60)  # 15s, 30s, 60s
                app.logger.warning(f"Gemini 429 — retrying in {wait}s (attempt {attempt+1}/{retries})")
                time.sleep(wait)
                continue
            raise  # Non-429 errors propagate immediately

    raise RuntimeError("Gemini rate limit exceeded after retries. Please wait and try again.")


def _classify_aqi(aqi: int) -> str:
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    if aqi <= 200:
        return "Unhealthy"
    return "Hazardous"


def _truncate_prompt(prompt: str, max_chars: int = 3500) -> str:
    """Hard guardrail to keep prompt size bounded even if upstream payloads are large."""
    if len(prompt) <= max_chars:
        return prompt

    head = int(max_chars * 0.65)
    tail = max_chars - head
    return (
        prompt[:head].rstrip()
        + "\n...[truncated to control token usage]...\n"
        + prompt[-tail:].lstrip()
    )


def _compact_historical_payload(historical: dict, max_points: int = 60) -> dict:
    """Keep only the latest values needed for trend/anomaly logic."""
    if not isinstance(historical, dict):
        return {}

    compact: dict = {}
    for key in ("aqi", "temperature", "humidity", "waterPh"):
        values = historical.get(key, [])
        if not isinstance(values, list):
            compact[key] = []
            continue

        trimmed = values[-max_points:]
        clean_vals = []
        for value in trimmed:
            try:
                clean_vals.append(round(float(value), 3))
            except (TypeError, ValueError):
                continue
        compact[key] = clean_vals

    timestamps = historical.get("timestamps", [])
    compact["timestamps"] = timestamps[-max_points:] if isinstance(timestamps, list) else []
    compact["points"] = len(compact.get("aqi", []))
    return compact


def _compute_env_score(sensor: dict) -> int:
    score = 100
    air = sensor.get("air", {})
    weather = sensor.get("weather", {})
    water = sensor.get("water", {})

    aqi = air.get("aqi", 0)
    if aqi > 50:
        score -= min(int((aqi - 50) * 0.3), 30)

    temp = float(weather.get("temperature", 20))
    if temp > 35 or temp < 5:
        score -= 10
    elif temp > 30 or temp < 10:
        score -= 5

    ph = float(water.get("ph", 7.0))
    if ph < 6.5 or ph > 8.5:
        score -= 10

    uv = float(weather.get("uvIndex", 0))
    if uv > 8:
        score -= 5

    return max(score, 0)


def _detect_anomalies(sensor: dict, historical: dict) -> list:
    """Threshold-based anomaly detection on sensor data."""
    anomalies = []
    air = sensor.get("air", {})
    weather = sensor.get("weather", {})
    water = sensor.get("water", {})

    # AQI
    aqi_hist = historical.get("aqi", [])
    if len(aqi_hist) >= 3:
        recent_avg = np.mean(aqi_hist[-5:])
        if recent_avg:
            delta_pct = ((air.get("aqi", 0) - recent_avg) / recent_avg) * 100
            if abs(delta_pct) > 15:
                anomalies.append({
                    "metric": "AQI",
                    "value": air["aqi"],
                    "baseline": round(recent_avg),
                    "delta": round(delta_pct, 1),
                    "severity": "critical" if abs(delta_pct) > 40 else "warning",
                    "direction": "rise" if delta_pct > 0 else "drop",
                    "message": f"AQI {'spiked' if delta_pct > 0 else 'dropped'} {abs(delta_pct):.0f}% from recent baseline",
                })

    # Temperature
    temp_hist = historical.get("temperature", [])
    if len(temp_hist) >= 3:
        temp_avg = np.mean(temp_hist[-5:])
        temp_val = float(weather.get("temperature", temp_avg))
        diff = abs(temp_val - temp_avg)
        if diff > 3:
            anomalies.append({
                "metric": "Temperature",
                "value": temp_val,
                "baseline": round(temp_avg, 1),
                "delta": round(diff, 1),
                "severity": "critical" if diff > 6 else "warning",
                "direction": "rise" if temp_val > temp_avg else "drop",
                "message": f"Temperature deviates {diff:.1f}°C from recent average",
            })

    # Water pH
    ph_val = float(water.get("ph", 7.0))
    if ph_val < 6.5 or ph_val > 8.5:
        anomalies.append({
            "metric": "Water pH",
            "value": ph_val,
            "baseline": 7.0,
            "delta": round(ph_val - 7.0, 2),
            "severity": "critical" if ph_val < 6.0 or ph_val > 9.0 else "warning",
            "direction": "rise" if ph_val > 7 else "drop",
            "message": f"pH {'acidic' if ph_val < 6.5 else 'alkaline'} — outside safe range (6.5-8.5)",
        })

    # Humidity
    hum = float(weather.get("humidity", 50))
    if hum > 85 or hum < 20:
        anomalies.append({
            "metric": "Humidity",
            "value": hum,
            "baseline": 50,
            "delta": round(hum - 50),
            "severity": "critical" if hum > 95 or hum < 10 else "warning",
            "direction": "rise" if hum > 50 else "drop",
            "message": f"Humidity {'very high' if hum > 85 else 'very low'} at {hum}%",
        })

    # PM2.5
    pm25 = float(air.get("pm25", 0))
    if pm25 > 35:
        anomalies.append({
            "metric": "PM2.5",
            "value": pm25,
            "baseline": 12,
            "delta": round(pm25 - 12, 1),
            "severity": "critical" if pm25 > 55 else "warning",
            "direction": "rise",
            "message": f"PM2.5 at {pm25} μg/m³ exceeds WHO guideline (15 μg/m³)",
        })

    return anomalies


def _sensor_summary(sensor: dict) -> str:
    """One-line compact summary of sensor readings for prompts."""
    air = sensor.get("air", {})
    weather = sensor.get("weather", {})
    water = sensor.get("water", {})
    return (
        f"AQI:{air.get('aqi','?')}({_classify_aqi(air.get('aqi',0))}) "
        f"PM2.5:{air.get('pm25','?')} PM10:{air.get('pm10','?')} "
        f"O3:{air.get('o3','?')} NO2:{air.get('no2','?')} SO2:{air.get('so2','?')} CO:{air.get('co','?')} | "
        f"Temp:{weather.get('temperature','?')}°C Hum:{weather.get('humidity','?')}% "
        f"Wind:{weather.get('windSpeed','?')}km/h UV:{weather.get('uvIndex','?')} "
        f"{weather.get('condition','')} | "
        f"pH:{water.get('ph','?')} DO:{water.get('dissolvedOxygen','?')} "
        f"Turb:{water.get('turbidity','?')} TDS:{water.get('tds','?')}"
    )


# ── Climate data processing with pandas ──────────────────────────────────

_climate_cache: dict = {}


def _load_climate_df() -> pd.DataFrame:
    """Load and cache the climate CSV using pandas."""
    if "df" in _climate_cache:
        return _climate_cache["df"]

    csv_path = os.path.join(os.path.dirname(__file__), "..", "public", "data", "GlobalTemperatures.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError("GlobalTemperatures.csv not found")

    df = pd.read_csv(csv_path)
    df = df.dropna(subset=["dt"])
    df["dt"] = pd.to_datetime(df["dt"], errors="coerce")
    df = df.dropna(subset=["dt", "LandAverageTemperature"])
    df["year"] = df["dt"].dt.year
    df["month"] = df["dt"].dt.month
    _climate_cache["df"] = df
    return df


def _compute_climate_stats() -> dict:
    """Full climate analytics using pandas — replaces frontend JS computation."""
    if "stats" in _climate_cache:
        return _climate_cache["stats"]

    df = _load_climate_df()

    # Yearly averages
    yearly = df.groupby("year").agg(
        landAvg=("LandAverageTemperature", "mean"),
        landMax=("LandMaxTemperature", "mean"),
        landMin=("LandMinTemperature", "mean"),
        landOceanAvg=("LandAndOceanAverageTemperature", "mean"),
        uncertainty=("LandAverageTemperatureUncertainty", "mean"),
    ).reset_index()
    yearly = yearly.sort_values("year")

    # Decadal averages
    yearly["decade"] = (yearly["year"] // 10) * 10
    decadal = yearly.groupby("decade").agg(
        avg=("landAvg", "mean"),
        maxT=("landAvg", "max"),
        minT=("landAvg", "min"),
        count=("landAvg", "count"),
    ).reset_index()
    decadal["range"] = decadal["maxT"] - decadal["minT"]
    baseline = decadal["avg"].iloc[0] if len(decadal) > 0 else 0
    decadal["anomaly"] = decadal["avg"] - baseline
    decadal["label"] = decadal["decade"].astype(str) + "s"

    # Anomalies (>1.5 std)
    mean_t = yearly["landAvg"].mean()
    std_t = yearly["landAvg"].std()
    threshold = 1.5
    anomaly_mask = (yearly["landAvg"] - mean_t).abs() > threshold * std_t
    anomalies_df = yearly[anomaly_mask].copy()
    anomalies_df["deviation"] = ((anomalies_df["landAvg"] - mean_t) / std_t).round(2)
    anomalies_df["type"] = anomalies_df["landAvg"].apply(lambda x: "warm" if x > mean_t else "cold")

    # Linear regression for trend
    x = yearly["year"].values.astype(float)
    y = yearly["landAvg"].values
    n = len(x)
    x_mean, y_mean = x.mean(), y.mean()
    slope = np.sum((x - x_mean) * (y - y_mean)) / np.sum((x - x_mean) ** 2)
    intercept = y_mean - slope * x_mean
    residuals = y - (slope * x + intercept)
    residual_std = np.std(residuals)
    slope_per_century = slope * 100

    # Projections
    last_year = int(yearly["year"].iloc[-1])
    proj_years = np.arange(last_year + 1, last_year + 51)
    proj_vals = slope * proj_years + intercept
    proj_unc = residual_std * np.sqrt(1 + np.arange(1, 51) / n) * 1.96

    # Risk index
    first3 = decadal["avg"].iloc[:3].mean() if len(decadal) >= 3 else decadal["avg"].mean()
    last3 = decadal["avg"].iloc[-3:].mean() if len(decadal) >= 3 else decadal["avg"].mean()
    acceleration = last3 - first3
    trend_score = min(abs(slope_per_century) * 30, 40)
    var_score = min(std_t * 5, 30)
    accel_score = min(max(acceleration, 0) * 15, 30)
    risk_total = round(min(trend_score + var_score + accel_score, 100))

    if risk_total >= 70:
        risk_level, risk_color = "Critical", "#ef4444"
    elif risk_total >= 45:
        risk_level, risk_color = "Elevated", "#f59e0b"
    elif risk_total >= 20:
        risk_level, risk_color = "Moderate", "#3b82f6"
    else:
        risk_level, risk_color = "Low", "#10b981"

    # Hottest / coldest
    hottest_idx = yearly["landAvg"].idxmax()
    coldest_idx = yearly["landAvg"].idxmin()
    warmest_decade_idx = decadal["avg"].idxmax()
    coldest_decade_idx = decadal["avg"].idxmin()

    total_change = round(decadal["avg"].iloc[-1] - decadal["avg"].iloc[0], 3) if len(decadal) >= 2 else 0

    # Seasonal
    seasons = {12: "Winter", 1: "Winter", 2: "Winter", 3: "Spring", 4: "Spring", 5: "Spring",
               6: "Summer", 7: "Summer", 8: "Summer", 9: "Autumn", 10: "Autumn", 11: "Autumn"}
    df["season"] = df["month"].map(seasons)
    seasonal = df.groupby("season")["LandAverageTemperature"].mean().round(2).to_dict()

    warm_anoms = int((anomalies_df["type"] == "warm").sum())
    cold_anoms = int((anomalies_df["type"] == "cold").sum())

    result = {
        "stats": {
            "totalRecords": int(len(yearly)),
            "yearRange": f"{int(yearly['year'].iloc[0])}–{int(yearly['year'].iloc[-1])}",
            "overallMean": round(mean_t, 3),
            "hottest": {"year": int(yearly.loc[hottest_idx, "year"]), "temp": round(yearly.loc[hottest_idx, "landAvg"], 3)},
            "coldest": {"year": int(yearly.loc[coldest_idx, "year"]), "temp": round(yearly.loc[coldest_idx, "landAvg"], 3)},
            "warmestDecade": {"decade": decadal.loc[warmest_decade_idx, "label"], "avg": round(decadal.loc[warmest_decade_idx, "avg"], 3)},
            "coldestDecade": {"decade": decadal.loc[coldest_decade_idx, "label"], "avg": round(decadal.loc[coldest_decade_idx, "avg"], 3)},
            "totalChange": total_change,
        },
        "risk": {
            "score": risk_total,
            "level": risk_level,
            "color": risk_color,
            "factors": {
                "warmingRate": round(slope_per_century, 4),
                "variability": round(std_t, 3),
                "acceleration": round(acceleration, 3),
            },
            "trendScore": round(trend_score),
            "variabilityScore": round(var_score),
            "accelerationScore": round(accel_score),
        },
        "yearly": [
            {
                "year": int(r.year), "landAvg": round(r.landAvg, 3),
                "landMax": None if pd.isna(r.landMax) else round(r.landMax, 3),
                "landMin": None if pd.isna(r.landMin) else round(r.landMin, 3),
                "landOceanAvg": None if pd.isna(r.landOceanAvg) else round(r.landOceanAvg, 3),
                "uncertainty": None if pd.isna(r.uncertainty) else round(r.uncertainty, 3),
            }
            for r in yearly.itertuples()
        ],
        "decadal": [
            {"decade": r.label, "decadeNum": int(r.decade), "avg": round(r.avg, 3), "range": round(r.range, 3), "anomaly": round(r.anomaly, 3)}
            for r in decadal.itertuples()
        ],
        "anomalies": [
            {"year": int(r.year), "temp": round(r.landAvg, 3), "deviation": float(r.deviation), "type": r.type}
            for r in anomalies_df.itertuples()
        ],
        "projections": [
            {"year": int(proj_years[i]), "predicted": round(float(proj_vals[i]), 3),
             "lower": round(float(proj_vals[i] - proj_unc[i]), 3),
             "upper": round(float(proj_vals[i] + proj_unc[i]), 3)}
            for i in range(len(proj_years))
        ],
        "seasonal": seasonal,
        "anomalySummary": {"total": len(anomalies_df), "warm": warm_anoms, "cold": cold_anoms},
    }
    _climate_cache["stats"] = result
    return result


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": GEMINI_MODEL, "hasKey": bool(GEMINI_API_KEY)})


# ── 1. Environmental Analysis ────────────────────────────────────────────

@app.route("/api/ai/analyze-environment", methods=["POST"])
def analyze_environment():
    """Analyse current sensor data. Heavy processing done here, compact prompt to Gemini."""
    data = request.get_json()
    sensor = data.get("sensorData", {})

    ck = _cache_key("env", sensor)
    cached = cache.get(ck)
    if cached:
        return jsonify(cached)

    env_score = _compute_env_score(sensor)
    summary_line = _sensor_summary(sensor)

    prompt = (
        f"Environmental snapshot (score {env_score}/100): {summary_line}\n"
        "Give: 1) 2-sentence summary 2) concerns list 3) 3 recommendations 4) 6h prediction.\n"
        "Format: SUMMARY: … | CONCERNS: … | RECOMMENDATIONS: … | PREDICTION: …"
    )

    try:
        text = _call_gemini(prompt, max_tokens=512, lite=True)
        result = _parse_sections(text)
    except Exception as e:
        result = _offline_analysis(sensor, env_score)

    result["envScore"] = env_score
    cache.set(ck, result)
    return jsonify(result)


def _parse_sections(text: str) -> dict:
    sections = {"summary": "", "concerns": [], "recommendations": [], "prediction": ""}
    current = ""
    for line in text.split("\n"):
        t = line.strip()
        upper = t.upper()
        if "SUMMARY" in upper:
            current = "summary"; continue
        elif "CONCERN" in upper:
            current = "concerns"; continue
        elif "RECOMMENDATION" in upper:
            current = "recommendations"; continue
        elif "PREDICTION" in upper:
            current = "prediction"; continue
        clean = t.lstrip("-•*0123456789.) ").strip()
        if clean and current:
            if current in ("concerns", "recommendations"):
                sections[current].append(clean)
            else:
                sections[current] += (" " if sections[current] else "") + clean
    return sections


def _offline_analysis(sensor: dict, score: int) -> dict:
    aqi = sensor.get("air", {}).get("aqi", 0)
    temp = float(sensor.get("weather", {}).get("temperature", 20))
    ph = float(sensor.get("water", {}).get("ph", 7.0))
    concerns, recs = [], []

    if aqi > 100:
        concerns.append(f"Elevated AQI of {aqi}")
        recs.append("Limit outdoor activities; wear an N95 mask outdoors.")
    if temp > 35:
        concerns.append("Heat advisory conditions")
        recs.append("Stay hydrated and avoid prolonged sun exposure.")
    if ph < 6.5 or ph > 8.5:
        concerns.append(f"Water pH {ph} outside safe range")
        recs.append("Avoid untreated water for drinking.")

    if not recs:
        recs.append("Continue monitoring environmental conditions.")

    return {
        "summary": f"Environment score {score}/100. AQI {aqi}, Temp {temp}°C, pH {ph}.",
        "concerns": concerns,
        "recommendations": recs,
        "prediction": "Conditions expected to remain stable in the next 6 hours.",
    }


# ── 2. Generate Report ───────────────────────────────────────────────────

@app.route("/api/ai/generate-report", methods=["POST"])
def generate_report():
    data = request.get_json()
    sensor = data.get("sensorData", {})
    alerts = data.get("alerts", [])[:5]

    env_score = _compute_env_score(sensor)
    summary_line = _sensor_summary(sensor)

    prompt = (
        f"Environmental report (score {env_score}/100): {summary_line} "
        f"Recent alerts: {len(alerts)}.\n"
        "Give: SUMMARY, CONCERNS, RECOMMENDATIONS, PREDICTION. Be concise."
    )

    try:
        text = _call_gemini(prompt, max_tokens=512, lite=True)
        analysis = _parse_sections(text)
    except Exception:
        analysis = _offline_analysis(sensor, env_score)

    return jsonify({
        "generatedAt": datetime.now().isoformat(),
        "envScore": env_score,
        "analysis": analysis,
        "currentReadings": sensor,
        "recentAlerts": alerts,
        "aqiCategory": {"label": _classify_aqi(sensor.get("air", {}).get("aqi", 0)), "color": "#10b981"},
    })


# ── 3. Analyze Trends ────────────────────────────────────────────────────

@app.route("/api/ai/analyze-trends", methods=["POST"])
def analyze_trends():
    data = request.get_json()
    sensor = data.get("sensorData", {})
    computed = data.get("computed", {})

    ck = _cache_key("trends", data)
    cached = cache.get(ck)
    if cached:
        return jsonify(cached)

    env_score = computed.get("envScore", _compute_env_score(sensor))
    aqi_trend = computed.get("aqiTrend", 0)
    temp_trend = computed.get("tempTrend", 0)
    anomaly_count = computed.get("anomalyCount", 0)

    # Compact summary — NO raw data sent
    prompt = (
        f"Env readings: {_sensor_summary(sensor)}\n"
        f"Computed: AQI trend={'rising' if aqi_trend > 0 else 'falling' if aqi_trend < 0 else 'stable'}({aqi_trend:.1f}), "
        f"temp trend={'rising' if temp_trend > 0 else 'falling' if temp_trend < 0 else 'stable'}({temp_trend:.1f}°C), "
        f"score={env_score}/100, anomalies={anomaly_count}.\n"
        "Return JSON: {trendSummary,airTrend:{direction,detail},tempTrend:{direction,detail},"
        "waterTrend:{direction,detail},forecast6h,forecast24h,confidence}. "
        "direction values: improving|stable|worsening for air; rising|stable|cooling for temp; safe|caution|unsafe for water. "
        "confidence: high|medium|low. JSON only."
    )

    try:
        result = _call_gemini(prompt, json_mode=True, max_tokens=512, lite=True)
    except Exception:
        result = {
            "trendSummary": "Unable to generate trend analysis.",
            "airTrend": {"direction": "stable", "detail": "Insufficient data for AI analysis."},
            "tempTrend": {"direction": "stable", "detail": "Insufficient data for AI analysis."},
            "waterTrend": {"direction": "safe", "detail": "Parameters within normal range."},
            "forecast6h": "Conditions expected to remain stable.",
            "forecast24h": "Monitor for changes.",
            "confidence": "low",
        }

    cache.set(ck, result)
    return jsonify(result)


# ── 4. Predict Anomalies ─────────────────────────────────────────────────

@app.route("/api/ai/predict-anomalies", methods=["POST"])
def predict_anomalies():
    data = request.get_json()
    sensor = data.get("sensorData", {})
    historical = _compact_historical_payload(data.get("historicalData", {}), max_points=72)

    # Do anomaly detection server-side
    local_anomalies = _detect_anomalies(sensor, historical)

    ck = _cache_key("anomalies", {"sensor": sensor, "anoms": local_anomalies})
    cached = cache.get(ck)
    if cached:
        cached["localAnomalies"] = local_anomalies
        return jsonify(cached)

    # Compact anomaly summary for Gemini
    anom_lines = "; ".join(a["message"] for a in local_anomalies) or "None detected"
    prompt = (
        f"Sensor: {_sensor_summary(sensor)}\n"
        f"Detected anomalies: {anom_lines}\n"
        "Predict 3-5 potential anomalies for next 6-12h as JSON: "
        "{predictions:[{metric,risk(high|medium|low),prediction,timeframe,probability(0-1)}],"
        "overallRisk(high|medium|low),summary}. JSON only."
    )

    try:
        result = _call_gemini(prompt, json_mode=True, max_tokens=512, lite=True)
    except Exception:
        result = {
            "predictions": [],
            "overallRisk": "low",
            "summary": "Unable to generate predictions.",
        }

    result["localAnomalies"] = local_anomalies
    cache.set(ck, result)
    return jsonify(result)


# ── 5. Health & Safety Recommendations ────────────────────────────────────

@app.route("/api/ai/health-recommendations", methods=["POST"])
def health_recommendations():
    data = request.get_json()
    sensor = data.get("sensorData", {})
    historical = _compact_historical_payload(data.get("historicalData", {}), max_points=48)
    anomaly_msgs = data.get("anomalyMessages", [])

    ck = _cache_key("health", sensor)
    cached = cache.get(ck)
    if cached:
        return jsonify(cached)

    env_score = _compute_env_score(sensor)
    aqi = sensor.get("air", {}).get("aqi", 0)

    prompt = (
        f"Env score:{env_score}/100, AQI:{aqi}({_classify_aqi(aqi)}), "
        f"readings:{_sensor_summary(sensor)}, "
        f"recentPoints:{historical.get('points', 0)}, "
        f"anomalies:{'; '.join(anomaly_msgs) or 'none'}.\n"
        "Return JSON: {urgentActions:[str],healthAdvisory:{category(safe|caution|warning|danger),message},"
        "recommendations:[{title,detail,icon(air|water|sun|health|indoor|outdoor),priority(high|medium|low)}],"
        "vulnerableGroups:[str],exerciseAdvice:str}. "
        "Include 4-6 recommendations. JSON only."
    )

    try:
        result = _call_gemini(prompt, json_mode=True, max_tokens=768)
    except Exception:
        result = {
            "urgentActions": [],
            "healthAdvisory": {"category": "safe", "message": "Conditions are normal."},
            "recommendations": [{"title": "Stay Informed", "detail": "Monitor conditions regularly.", "icon": "health", "priority": "low"}],
            "vulnerableGroups": [],
            "exerciseAdvice": "Outdoor exercise appears safe in current conditions.",
        }

    cache.set(ck, result)
    return jsonify(result)


# ── 6. Climate Policy Brief ──────────────────────────────────────────────

@app.route("/api/ai/climate-policy-brief", methods=["POST"])
def climate_policy_brief():
    """Process climate data with pandas, send compact summary to Gemini."""
    ck = _cache_key("climate_brief", {})
    cached = cache.get(ck)
    if cached:
        return jsonify(cached)

    try:
        cs = _compute_climate_stats()
    except FileNotFoundError:
        return jsonify({"error": "Climate data file not found"}), 404

    s = cs["stats"]
    r = cs["risk"]
    proj = cs["projections"][-1] if cs["projections"] else {}
    anom = cs["anomalySummary"]

    # Very compact prompt — only computed statistics, no raw data
    prompt = (
        f"Climate data: {s['yearRange']}, {s['totalRecords']} yr records.\n"
        f"Warming: {r['factors']['warmingRate']}°C/century, σ={r['factors']['variability']}°C, "
        f"accel={r['factors']['acceleration']}°C, risk={r['score']}/100({r['level']}).\n"
        f"Hottest: {s['hottest']['year']}({s['hottest']['temp']}°C), "
        f"coldest: {s['coldest']['year']}({s['coldest']['temp']}°C), "
        f"change: {s['totalChange']}°C.\n"
        f"Anomalies: {anom['total']}({anom['warm']}warm,{anom['cold']}cold). "
        f"50yr proj: {proj.get('predicted','?')}°C(CI:{proj.get('lower','?')}–{proj.get('upper','?')}).\n"
        "Return JSON policy brief: {executiveSummary,keyRisks:[{risk,evidence,urgency(immediate|short-term|long-term)}],"
        "policyRecommendations:[{action,rationale,timeline,impact(high|medium|low)}],"
        "dataLimitations:[str],confidenceLevel(high|medium|low),confidenceExplanation}. "
        "3-4 risks, 3-5 recs. Reference the numbers. JSON only."
    )

    try:
        result = _call_gemini(prompt, json_mode=True, max_tokens=1024)  # full model for policy brief
    except Exception as e:
        return jsonify({"error": f"AI generation failed: {str(e)}"}), 500

    cache.set(ck, result, timeout=CLIMATE_CACHE_TTL)  # 24h cache — climate data is static
    return jsonify(result)


# ── 7. Air Quality Recommendations ───────────────────────────────────────

@app.route("/api/ai/air-quality-recommendations", methods=["POST"])
def air_quality_recommendations():
    data = request.get_json()
    air = data.get("air", {})

    ck = _cache_key("aq_recs", air)
    cached = cache.get(ck)
    if cached:
        return jsonify(cached)

    aqi = air.get("aqi", 0)
    prompt = (
        f"AQI:{aqi}({_classify_aqi(aqi)}) PM2.5:{air.get('pm25','?')} PM10:{air.get('pm10','?')} "
        f"O3:{air.get('o3','?')} NO2:{air.get('no2','?')} SO2:{air.get('so2','?')} CO:{air.get('co','?')}.\n"
        "Return JSON array of 4-6 health recommendations: [{icon:'emoji',text:'one sentence'}]. JSON only."
    )

    try:
        result = _call_gemini(prompt, json_mode=True, max_tokens=384, lite=True)
        # Might parse as dict wrapping an array
        if isinstance(result, dict):
            result = result.get("recommendations", [result])
    except Exception:
        # Fallback
        result = [
            {"icon": "🏃", "text": "Air quality is ideal for outdoor activities." if aqi <= 50 else "Limit outdoor physical activities."},
            {"icon": "🪟", "text": "Great time to ventilate your home." if aqi <= 50 else "Keep windows closed."},
            {"icon": "😷", "text": "No mask needed." if aqi <= 100 else "Wear an N95 mask outdoors."},
            {"icon": "💧", "text": "Stay well hydrated."},
        ]

    recs = {"recommendations": result}
    cache.set(ck, recs)
    return jsonify(recs)


# ── 8. Climate Data (pre-processed) ──────────────────────────────────────

@app.route("/api/climate/data", methods=["GET"])
def climate_data():
    """Return all pre-processed climate analytics. No Gemini call — pure pandas."""
    try:
        result = _compute_climate_stats()
        return jsonify(result)
    except FileNotFoundError:
        return jsonify({"error": "Climate data file not found"}), 404


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_ENV", "production") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
