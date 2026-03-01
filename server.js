/**
 * EcoMonitor — Node.js/Express Backend
 * ─────────────────────────────────────
 * Replaces the Python Flask backend. All Gemini AI calls go through here.
 * Climate data is fetched from Supabase (global_temperatures table) or
 * falls back to the local CSV.
 *
 * ENV vars (from .env — shared with the Vite frontend):
 *   GEMINI_API_KEY          – Google AI Studio key
 *   VITE_SUPABASE_URL       – Supabase project URL
 *   VITE_SUPABASE_ANON_KEY  – Supabase anon public key
 *   SUPABASE_SERVICE_KEY    – (optional) service role key for server-side
 */

import 'dotenv/config';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { parse } from 'csv-parse/sync';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env from project root ──────────────────────────────────────────
import { config } from 'dotenv';
config({ path: resolve(__dirname, '.env') });

// ── Express setup ────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || process.env.FLASK_PORT || 5000;

// ── Supabase ─────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (SUPABASE_URL && SUPABASE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

// ── Gemini ───────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_MODEL_LITE = process.env.GEMINI_MODEL_LITE || 'gemini-2.0-flash-lite';

let genai = null;
if (GEMINI_API_KEY) {
    genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

// ── Rate limiter ─────────────────────────────────────────────────────────
const MAX_RPM = parseInt(process.env.MAX_GEMINI_RPM || '10', 10);
const rateCalls = [];

function rateLimitWait() {
    return new Promise((resolve) => {
        const now = Date.now();
        while (rateCalls.length && now - rateCalls[0] > 60_000) rateCalls.shift();
        if (rateCalls.length >= MAX_RPM) {
            const wait = 60_000 - (now - rateCalls[0]) + 500;
            setTimeout(resolve, Math.max(wait, 0));
        } else {
            resolve();
        }
        rateCalls.push(Date.now());
    });
}

// ── Simple in-memory cache ───────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '1800', 10) * 1000;
const CLIMATE_CACHE_TTL = parseInt(process.env.CLIMATE_CACHE_TTL || '86400', 10) * 1000;

function cacheGet(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > (entry.ttl || CACHE_TTL)) { cache.delete(key); return null; }
    return entry.data;
}
function cacheSet(key, data, ttl = CACHE_TTL) {
    cache.set(key, { data, ts: Date.now(), ttl });
}

import { createHash } from 'node:crypto';
function cacheKey(prefix, obj) {
    return `${prefix}:${createHash('md5').update(JSON.stringify(obj)).digest('hex')}`;
}

// ── Gemini helper ────────────────────────────────────────────────────────
function truncatePrompt(prompt, max = 6000) {
    if (prompt.length <= max) return prompt;
    const head = Math.floor(max * 0.7);
    const tail = max - head;
    return prompt.slice(0, head).trimEnd() +
        '\n...[truncated]...\n' +
        prompt.slice(-tail).trimStart();
}

async function callGemini(prompt, { jsonMode = false, maxTokens = 1024, lite = false, retries = 3 } = {}) {
    if (!genai) throw new Error('Gemini API key not configured');

    prompt = truncatePrompt(prompt);
    const model = lite ? GEMINI_MODEL_LITE : GEMINI_MODEL;

    for (let attempt = 0; attempt < retries; attempt++) {
        await rateLimitWait();
        try {
            const response = await genai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    temperature: jsonMode ? 0.4 : 0.7,
                    maxOutputTokens: maxTokens,
                },
            });

            let text = response.text.trim();

            if (jsonMode) {
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                // Extract JSON object or array
                const objStart = text.indexOf('{');
                const objEnd = text.lastIndexOf('}');
                const arrStart = text.indexOf('[');
                const arrEnd = text.lastIndexOf(']');
                if (objStart !== -1 && objEnd > objStart) {
                    text = text.slice(objStart, objEnd + 1);
                } else if (arrStart !== -1 && arrEnd > arrStart) {
                    text = text.slice(arrStart, arrEnd + 1);
                }
                return JSON.parse(text);
            }
            return text;
        } catch (err) {
            const msg = String(err?.message || err);
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
                const wait = Math.min(2 ** attempt * 15_000, 60_000);
                console.warn(`Gemini 429 — retrying in ${wait / 1000}s (attempt ${attempt + 1}/${retries})`);
                await new Promise(r => setTimeout(r, wait));
                continue;
            }
            throw err;
        }
    }
    throw new Error('Gemini rate limit exceeded after retries.');
}

// ── Sensor helpers ───────────────────────────────────────────────────────
function classifyAqi(aqi) {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    return 'Hazardous';
}

function sensorSummary(sensor) {
    const air = sensor?.air || {};
    const weather = sensor?.weather || {};
    const water = sensor?.water || {};
    return `AQI:${air.aqi ?? '?'}(${classifyAqi(air.aqi || 0)}) PM2.5:${air.pm25 ?? '?'} PM10:${air.pm10 ?? '?'} ` +
        `O3:${air.o3 ?? '?'} NO2:${air.no2 ?? '?'} SO2:${air.so2 ?? '?'} CO:${air.co ?? '?'} | ` +
        `Temp:${weather.temperature ?? '?'}°C Hum:${weather.humidity ?? '?'}% ` +
        `Wind:${weather.windSpeed ?? '?'}km/h UV:${weather.uvIndex ?? '?'} ${weather.condition || ''} | ` +
        `pH:${water.ph ?? '?'} DO:${water.dissolvedOxygen ?? '?'} Turb:${water.turbidity ?? '?'} TDS:${water.tds ?? '?'}`;
}

function computeEnvScore(sensor) {
    let score = 100;
    const aqi = sensor?.air?.aqi || 0;
    const temp = parseFloat(sensor?.weather?.temperature ?? 20);
    const ph = parseFloat(sensor?.water?.ph ?? 7);
    const uv = parseFloat(sensor?.weather?.uvIndex ?? 0);

    if (aqi > 50) score -= Math.min(Math.floor((aqi - 50) * 0.3), 30);
    if (temp > 35 || temp < 5) score -= 10;
    else if (temp > 30 || temp < 10) score -= 5;
    if (ph < 6.5 || ph > 8.5) score -= 10;
    if (uv > 8) score -= 5;
    return Math.max(score, 0);
}

function compactHistorical(hist, max = 60) {
    if (!hist || typeof hist !== 'object') return {};
    const compact = {};
    for (const key of ['aqi', 'temperature', 'humidity', 'waterPh']) {
        const arr = Array.isArray(hist[key]) ? hist[key] : [];
        compact[key] = arr.slice(-max).map(v => { const n = Number(v); return Number.isFinite(n) ? +n.toFixed(3) : null; }).filter(x => x !== null);
    }
    compact.timestamps = Array.isArray(hist.timestamps) ? hist.timestamps.slice(-max) : [];
    compact.points = compact.aqi.length;
    return compact;
}

function detectAnomalies(sensor, historical) {
    const anomalies = [];
    const air = sensor?.air || {};
    const weather = sensor?.weather || {};
    const water = sensor?.water || {};

    const aqiHist = historical?.aqi || [];
    if (aqiHist.length >= 3) {
        const avg = aqiHist.slice(-5).reduce((a, b) => a + b, 0) / Math.min(aqiHist.length, 5);
        if (avg) {
            const delta = ((air.aqi || 0) - avg) / avg * 100;
            if (Math.abs(delta) > 15) {
                anomalies.push({
                    metric: 'AQI', value: air.aqi, baseline: Math.round(avg),
                    delta: +delta.toFixed(1), severity: Math.abs(delta) > 40 ? 'critical' : 'warning',
                    direction: delta > 0 ? 'rise' : 'drop',
                    message: `AQI ${delta > 0 ? 'spiked' : 'dropped'} ${Math.abs(delta).toFixed(0)}% from recent baseline`,
                });
            }
        }
    }

    const tempHist = historical?.temperature || [];
    if (tempHist.length >= 3) {
        const avg = tempHist.slice(-5).reduce((a, b) => a + b, 0) / Math.min(tempHist.length, 5);
        const val = parseFloat(weather.temperature ?? avg);
        const diff = Math.abs(val - avg);
        if (diff > 3) {
            anomalies.push({
                metric: 'Temperature', value: val, baseline: +avg.toFixed(1),
                delta: +diff.toFixed(1), severity: diff > 6 ? 'critical' : 'warning',
                direction: val > avg ? 'rise' : 'drop',
                message: `Temperature deviates ${diff.toFixed(1)}°C from recent average`,
            });
        }
    }

    const phVal = parseFloat(water.ph ?? 7);
    if (phVal < 6.5 || phVal > 8.5) {
        anomalies.push({
            metric: 'Water pH', value: phVal, baseline: 7.0,
            delta: +(phVal - 7).toFixed(2), severity: (phVal < 6 || phVal > 9) ? 'critical' : 'warning',
            direction: phVal > 7 ? 'rise' : 'drop',
            message: `pH ${phVal < 6.5 ? 'acidic' : 'alkaline'} — outside safe range (6.5-8.5)`,
        });
    }

    const hum = parseFloat(weather.humidity ?? 50);
    if (hum > 85 || hum < 20) {
        anomalies.push({
            metric: 'Humidity', value: hum, baseline: 50, delta: Math.round(hum - 50),
            severity: (hum > 95 || hum < 10) ? 'critical' : 'warning',
            direction: hum > 50 ? 'rise' : 'drop',
            message: `Humidity ${hum > 85 ? 'very high' : 'very low'} at ${hum}%`,
        });
    }

    const pm25 = parseFloat(air.pm25 ?? 0);
    if (pm25 > 35) {
        anomalies.push({
            metric: 'PM2.5', value: pm25, baseline: 12, delta: +(pm25 - 12).toFixed(1),
            severity: pm25 > 55 ? 'critical' : 'warning', direction: 'rise',
            message: `PM2.5 at ${pm25} μg/m³ exceeds WHO guideline (15 μg/m³)`,
        });
    }
    return anomalies;
}

/* Build meaningful offline predictions from locally detected anomalies */
function buildOfflinePredictions(sensor, localAnoms) {
    const predictions = [];
    const air = sensor?.air || {};
    const weather = sensor?.weather || {};
    const water = sensor?.water || {};

    // Generate predictions from each detected anomaly
    for (const a of localAnoms) {
        if (a.metric === 'AQI' && a.direction === 'rise') {
            predictions.push({
                metric: 'Air Quality Index',
                risk: a.severity === 'critical' ? 'high' : 'medium',
                prediction: `AQI currently ${a.value} (baseline ${a.baseline}). Elevated levels may persist or worsen in the next 6-12 hours if emission sources remain active.`,
                timeframe: '6-12 hours',
                probability: a.severity === 'critical' ? 0.8 : 0.6,
            });
        } else if (a.metric === 'PM2.5') {
            predictions.push({
                metric: 'PM2.5 Concentration',
                risk: a.severity === 'critical' ? 'high' : 'medium',
                prediction: `PM2.5 at ${a.value} μg/m³ exceeds safe limits. Fine particulate matter may accumulate further, especially during low-wind or inversion conditions.`,
                timeframe: '6-8 hours',
                probability: a.severity === 'critical' ? 0.75 : 0.55,
            });
        } else if (a.metric === 'Water pH') {
            predictions.push({
                metric: 'Water pH Level',
                risk: a.severity === 'critical' ? 'high' : 'medium',
                prediction: `pH at ${a.value} is outside the safe range (6.5-8.5). Without intervention, ${a.value < 6.5 ? 'acidification' : 'alkalinity'} may continue to drift.`,
                timeframe: '8-12 hours',
                probability: 0.6,
            });
        } else if (a.metric === 'Temperature') {
            predictions.push({
                metric: 'Temperature Anomaly',
                risk: a.severity === 'critical' ? 'high' : 'medium',
                prediction: `Temperature at ${a.value}°C deviates ${a.delta}°C from the recent average. ${a.direction === 'rise' ? 'Heat stress risk may increase' : 'Cold weather advisories may apply'}.`,
                timeframe: '6-12 hours',
                probability: 0.5,
            });
        } else if (a.metric === 'Humidity') {
            predictions.push({
                metric: 'Humidity Level',
                risk: 'medium',
                prediction: `Humidity at ${a.value}% — ${a.value > 85 ? 'respiratory stress and mold risk may increase' : 'dry conditions could aggravate respiratory and skin conditions'}.`,
                timeframe: '6-8 hours',
                probability: 0.5,
            });
        }
    }

    // Add general predictions based on sensor state if we have few detections
    if (predictions.length < 2) {
        const aqi = air.aqi || 0;
        if (aqi > 100) {
            predictions.push({
                metric: 'Air Quality',
                risk: aqi > 150 ? 'high' : 'medium',
                prediction: `AQI at ${aqi} indicates ${aqi > 150 ? 'unhealthy' : 'moderate'} air quality. Sensitive groups should limit outdoor exposure.`,
                timeframe: '6-12 hours',
                probability: 0.55,
            });
        }
        const uv = parseFloat(weather.uvIndex ?? 0);
        if (uv > 6) {
            predictions.push({
                metric: 'UV Exposure',
                risk: uv > 8 ? 'high' : 'medium',
                prediction: `UV index at ${uv} — ${uv > 8 ? 'very high' : 'high'} risk of sunburn and skin damage during peak hours.`,
                timeframe: '4-8 hours',
                probability: 0.7,
            });
        }
    }

    // Fallback if nothing detected at all
    if (predictions.length === 0) {
        predictions.push({
            metric: 'General Conditions',
            risk: 'low',
            prediction: 'Current environmental conditions appear stable. Continue routine monitoring.',
            timeframe: '6-12 hours',
            probability: 0.3,
        });
    }

    const hasCritical = localAnoms.some(a => a.severity === 'critical');
    const hasWarning = localAnoms.some(a => a.severity === 'warning');
    const overallRisk = hasCritical ? 'high' : hasWarning ? 'medium' : 'low';

    const summary = predictions.length > 1
        ? `${predictions.length} potential anomalies predicted based on current sensor readings and detected deviations. ${hasCritical ? 'Immediate attention recommended for critical-level metrics.' : 'Monitor conditions closely.'}`
        : predictions[0].prediction;

    return { predictions, overallRisk, summary };
}

function parseSections(text) {
    const sections = { summary: '', concerns: [], recommendations: [], prediction: '' };
    let current = '';
    for (const line of text.split('\n')) {
        const t = line.trim();
        const upper = t.toUpperCase();
        if (upper.includes('SUMMARY')) { current = 'summary'; continue; }
        if (upper.includes('CONCERN')) { current = 'concerns'; continue; }
        if (upper.includes('RECOMMENDATION')) { current = 'recommendations'; continue; }
        if (upper.includes('PREDICTION')) { current = 'prediction'; continue; }
        const clean = t.replace(/^[-•*0-9.)]+\s*/, '').trim();
        if (clean && current) {
            if (current === 'concerns' || current === 'recommendations') sections[current].push(clean);
            else sections[current] += (sections[current] ? ' ' : '') + clean;
        }
    }
    return sections;
}

function offlineAnalysis(sensor, score) {
    const aqi = sensor?.air?.aqi || 0;
    const temp = parseFloat(sensor?.weather?.temperature ?? 20);
    const ph = parseFloat(sensor?.water?.ph ?? 7);
    const concerns = [], recs = [];

    if (aqi > 100) { concerns.push(`Elevated AQI of ${aqi}`); recs.push('Limit outdoor activities; wear an N95 mask outdoors.'); }
    if (temp > 35) { concerns.push('Heat advisory conditions'); recs.push('Stay hydrated and avoid prolonged sun exposure.'); }
    if (ph < 6.5 || ph > 8.5) { concerns.push(`Water pH ${ph} outside safe range`); recs.push('Avoid untreated water for drinking.'); }
    if (!recs.length) recs.push('Continue monitoring environmental conditions.');

    return {
        summary: `Environment score ${score}/100. AQI ${aqi}, Temp ${temp}°C, pH ${ph}.`,
        concerns, recommendations: recs,
        prediction: 'Conditions expected to remain stable in the next 6 hours.',
    };
}

// ── Climate CSV processing (replaces pandas) ─────────────────────────────
let climateCache = null;

function loadClimateCSV() {
    if (climateCache) return climateCache;

    const csvPath = resolve(__dirname, 'public', 'data', 'GlobalTemperatures.csv');
    if (!existsSync(csvPath)) throw new Error('GlobalTemperatures.csv not found');

    const raw = readFileSync(csvPath, 'utf-8');
    const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

    const rows = records
        .filter(r => r.dt && r.LandAverageTemperature)
        .map(r => ({
            dt: r.dt,
            year: parseInt(r.dt.split('-')[0]),
            month: parseInt(r.dt.split('-')[1]),
            landAvg: parseFloat(r.LandAverageTemperature) || null,
            landAvgUnc: parseFloat(r.LandAverageTemperatureUncertainty) || null,
            landMax: parseFloat(r.LandMaxTemperature) || null,
            landMin: parseFloat(r.LandMinTemperature) || null,
            landOceanAvg: parseFloat(r.LandAndOceanAverageTemperature) || null,
        }))
        .filter(r => r.landAvg !== null);

    climateCache = rows;
    return rows;
}

// ── Compute statistics for ANY date range (zero tokens) ──────────────────
function computeRangeStats(startYear, endYear) {
    const ck = `range_stats:${startYear}:${endYear}`;
    const cached = cacheGet(ck);
    if (cached) return cached;

    const allRows = loadClimateCSV();
    const rows = allRows.filter(r => r.year >= startYear && r.year <= endYear);
    if (!rows.length) return null;

    // ── Yearly averages ──
    const yearMap = {};
    for (const r of rows) {
        if (!yearMap[r.year]) yearMap[r.year] = { sums: { la: 0, lmax: 0, lmin: 0, lo: 0, unc: 0 }, counts: { la: 0, lmax: 0, lmin: 0, lo: 0, unc: 0 } };
        const y = yearMap[r.year];
        if (r.landAvg != null) { y.sums.la += r.landAvg; y.counts.la++; }
        if (r.landMax != null) { y.sums.lmax += r.landMax; y.counts.lmax++; }
        if (r.landMin != null) { y.sums.lmin += r.landMin; y.counts.lmin++; }
        if (r.landOceanAvg != null) { y.sums.lo += r.landOceanAvg; y.counts.lo++; }
        if (r.landAvgUnc != null) { y.sums.unc += r.landAvgUnc; y.counts.unc++; }
    }
    const yearly = Object.entries(yearMap).map(([yr, y]) => ({
        year: +yr,
        landAvg: y.counts.la ? +(y.sums.la / y.counts.la).toFixed(3) : null,
        landMax: y.counts.lmax ? +(y.sums.lmax / y.counts.lmax).toFixed(3) : null,
        landMin: y.counts.lmin ? +(y.sums.lmin / y.counts.lmin).toFixed(3) : null,
        landOceanAvg: y.counts.lo ? +(y.sums.lo / y.counts.lo).toFixed(3) : null,
        uncertainty: y.counts.unc ? +(y.sums.unc / y.counts.unc).toFixed(3) : null,
    })).sort((a, b) => a.year - b.year);

    // ── Decadal ──
    const decMap = {};
    for (const y of yearly) {
        const d = Math.floor(y.year / 10) * 10;
        if (!decMap[d]) decMap[d] = { sum: 0, count: 0, max: -Infinity, min: Infinity };
        if (y.landAvg != null) {
            decMap[d].sum += y.landAvg; decMap[d].count++;
            decMap[d].max = Math.max(decMap[d].max, y.landAvg);
            decMap[d].min = Math.min(decMap[d].min, y.landAvg);
        }
    }
    const decadal = Object.entries(decMap)
        .filter(([, d]) => d.count > 0)
        .map(([dec, d]) => ({
            decade: `${dec}s`, decadeNum: +dec,
            avg: +(d.sum / d.count).toFixed(3),
            range: +(d.max - d.min).toFixed(3),
        }))
        .sort((a, b) => a.decadeNum - b.decadeNum);
    const baseline = decadal[0]?.avg || 0;
    for (const d of decadal) d.anomaly = +(d.avg - baseline).toFixed(3);

    // ── Anomalies (statistical) ──
    const temps = yearly.filter(y => y.landAvg != null);
    const mean = temps.reduce((s, y) => s + y.landAvg, 0) / (temps.length || 1);
    const std = Math.sqrt(temps.reduce((s, y) => s + (y.landAvg - mean) ** 2, 0) / (temps.length || 1));
    const anomalies = temps
        .filter(y => Math.abs(y.landAvg - mean) > 1.5 * std)
        .map(y => ({
            year: y.year, temp: y.landAvg,
            deviation: +((y.landAvg - mean) / (std || 1)).toFixed(2),
            type: y.landAvg > mean ? 'warm' : 'cold',
        }));

    // ── Linear regression ──
    const n = temps.length || 1;
    const xMean = temps.reduce((s, y) => s + y.year, 0) / n;
    let num = 0, den = 0;
    for (const t of temps) { num += (t.year - xMean) * (t.landAvg - mean); den += (t.year - xMean) ** 2; }
    const slope = den ? num / den : 0;
    const intercept = mean - slope * xMean;
    const ssRes = temps.reduce((s, t) => s + (t.landAvg - (slope * t.year + intercept)) ** 2, 0);
    const ssTot = temps.reduce((s, t) => s + (t.landAvg - mean) ** 2, 0);
    const rSquared = ssTot ? 1 - ssRes / ssTot : 0;
    const resStd = Math.sqrt(ssRes / n);
    const slopePer100 = slope * 100;
    const slopePerDecade = slope * 10;

    // ── Projections ──
    const lastYear = temps.at(-1)?.year || endYear;
    const projections = [];
    for (let i = 1; i <= 50; i++) {
        const yr = lastYear + i;
        const pred = +(slope * yr + intercept).toFixed(3);
        const unc = +(resStd * Math.sqrt(1 + i / n) * 1.96).toFixed(3);
        projections.push({ year: yr, predicted: pred, lower: +(pred - unc).toFixed(3), upper: +(pred + unc).toFixed(3) });
    }

    // ── Risk index ──
    const first3 = decadal.slice(0, 3);
    const last3 = decadal.slice(-3);
    const f3avg = first3.length ? first3.reduce((s, d) => s + d.avg, 0) / first3.length : 0;
    const l3avg = last3.length ? last3.reduce((s, d) => s + d.avg, 0) / last3.length : 0;
    const accel = l3avg - f3avg;
    const trendScore = Math.min(Math.abs(slopePer100) * 30, 40);
    const varScore = Math.min(std * 5, 30);
    const accelScore = Math.min(Math.max(accel, 0) * 15, 30);
    const riskTotal = Math.round(Math.min(trendScore + varScore + accelScore, 100));
    const [riskLevel, riskColor] = riskTotal >= 70 ? ['Critical', '#ef4444'] :
        riskTotal >= 45 ? ['Elevated', '#f59e0b'] :
            riskTotal >= 20 ? ['Moderate', '#3b82f6'] : ['Low', '#10b981'];

    // ── Records ──
    const sorted = [...temps].sort((a, b) => b.landAvg - a.landAvg);
    const hottest = sorted[0] || { year: 0, landAvg: 0 };
    const coldest = sorted.at(-1) || { year: 0, landAvg: 0 };
    const warmestDec = [...decadal].sort((a, b) => b.avg - a.avg)[0] || { decade: '?', avg: 0 };
    const coldestDec = [...decadal].sort((a, b) => a.avg - b.avg)[0] || { decade: '?', avg: 0 };
    const totalChange = decadal.length >= 2 ? +(decadal.at(-1).avg - decadal[0].avg).toFixed(3) : 0;

    // ── Seasonal ──
    const seasons = {};
    for (const r of rows) {
        const m = r.month;
        const s = (m === 12 || m <= 2) ? 'Winter' : m <= 5 ? 'Spring' : m <= 8 ? 'Summer' : 'Autumn';
        if (!seasons[s]) seasons[s] = { sum: 0, count: 0 };
        if (r.landAvg != null) { seasons[s].sum += r.landAvg; seasons[s].count++; }
    }
    const seasonal = {};
    for (const [s, d] of Object.entries(seasons)) seasonal[s] = d.count ? +(d.sum / d.count).toFixed(2) : 0;

    const warm = anomalies.filter(a => a.type === 'warm').length;
    const cold = anomalies.filter(a => a.type === 'cold').length;

    // Top 5 warmest & coldest years (for the compact digest)
    const top5warm = sorted.slice(0, 5).map(y => `${y.year}(${y.landAvg}°C)`);
    const top5cold = sorted.slice(-5).reverse().map(y => `${y.year}(${y.landAvg}°C)`);

    const result = {
        stats: {
            totalRecords: yearly.length,
            monthlyRecords: rows.length,
            yearRange: `${yearly[0]?.year}–${yearly.at(-1)?.year}`,
            overallMean: +mean.toFixed(3),
            std: +std.toFixed(3),
            hottest: { year: hottest.year, temp: hottest.landAvg },
            coldest: { year: coldest.year, temp: coldest.landAvg },
            warmestDecade: { decade: warmestDec.decade, avg: warmestDec.avg },
            coldestDecade: { decade: coldestDec.decade, avg: coldestDec.avg },
            totalChange,
        },
        trend: {
            slopePerDecade: +slopePerDecade.toFixed(4),
            slopePer100: +slopePer100.toFixed(4),
            rSquared: +rSquared.toFixed(4),
            intercept: +intercept.toFixed(3),
        },
        risk: {
            score: riskTotal, level: riskLevel, color: riskColor,
            factors: { warmingRate: +slopePer100.toFixed(4), variability: +std.toFixed(3), acceleration: +accel.toFixed(3) },
            trendScore: Math.round(trendScore), variabilityScore: Math.round(varScore), accelerationScore: Math.round(accelScore),
        },
        yearly, decadal, anomalies, projections, seasonal,
        anomalySummary: { total: anomalies.length, warm, cold },
        top5warm, top5cold,
    };

    cacheSet(ck, result, CLIMATE_CACHE_TTL);
    return result;
}

/**
 * Build a compact text digest from pre-computed stats (~500 chars).
 * This is what we send to Gemini instead of raw data rows.
 * Token cost: ~150-200 input tokens (vs 3000-5000 for raw data).
 */
function buildStatsDigest(stats) {
    const s = stats.stats;
    const t = stats.trend;
    const r = stats.risk;
    const proj10 = stats.projections[9] || {};
    const proj50 = stats.projections.at(-1) || {};
    const a = stats.anomalySummary;
    const sea = stats.seasonal;

    return [
        `Period: ${s.yearRange} (${s.totalRecords} years, ${s.monthlyRecords} monthly records)`,
        `Mean: ${s.overallMean}°C, StdDev: ${s.std}°C`,
        `Trend: ${t.slopePerDecade > 0 ? '+' : ''}${t.slopePerDecade}°C/decade (R²=${t.rSquared})`,
        `Hottest year: ${s.hottest.year} (${s.hottest.temp}°C), Coldest: ${s.coldest.year} (${s.coldest.temp}°C)`,
        `Warmest decade: ${s.warmestDecade.decade} (${s.warmestDecade.avg}°C), Coldest: ${s.coldestDecade.decade} (${s.coldestDecade.avg}°C)`,
        `Total change: ${s.totalChange > 0 ? '+' : ''}${s.totalChange}°C (first to last decade)`,
        `Top warm years: ${stats.top5warm.join(', ')}`,
        `Top cold years: ${stats.top5cold.join(', ')}`,
        `Anomalies: ${a.total} significant (${a.warm} warm, ${a.cold} cold)`,
        `Seasonal avgs: Winter=${sea.Winter ?? '?'}°C, Spring=${sea.Spring ?? '?'}°C, Summer=${sea.Summer ?? '?'}°C, Autumn=${sea.Autumn ?? '?'}°C`,
        `Risk: ${r.score}/100 (${r.level}) — warming=${r.trendScore}/40, variability=${r.variabilityScore}/30, acceleration=${r.accelerationScore}/30`,
        `10yr projection: ${proj10.predicted ?? '?'}°C (${proj10.lower ?? '?'}–${proj10.upper ?? '?'})`,
        `50yr projection: ${proj50.predicted ?? '?'}°C (${proj50.lower ?? '?'}–${proj50.upper ?? '?'})`,
    ].join('\n');
}

/**
 * Generate a fallback narrative from stats (no AI needed).
 * Used when Gemini is unavailable or rate-limited.
 */
function buildOfflineClimateNarrative(stats) {
    const s = stats.stats;
    const t = stats.trend;
    const r = stats.risk;
    const a = stats.anomalySummary;
    const proj50 = stats.projections.at(-1) || {};

    const trendDir = t.slopePerDecade > 0.02 ? 'warming' : t.slopePerDecade < -0.02 ? 'cooling' : 'relatively stable';
    const trendStrength = Math.abs(t.slopePerDecade) > 0.1 ? 'significant' : Math.abs(t.slopePerDecade) > 0.05 ? 'moderate' : 'slight';

    return `## Summary
The global temperature record from ${s.yearRange} shows a ${trendStrength} ${trendDir} trend of ${t.slopePerDecade > 0 ? '+' : ''}${t.slopePerDecade}°C per decade (R²=${t.rSquared}). The overall mean temperature is ${s.overallMean}°C with a total change of ${s.totalChange > 0 ? '+' : ''}${s.totalChange}°C from the first to last decade analyzed.

## Key Trends
- **Warming rate**: ${Math.abs(t.slopePer100).toFixed(2)}°C per century
- **Hottest year on record**: ${s.hottest.year} at ${s.hottest.temp}°C
- **Coldest year on record**: ${s.coldest.year} at ${s.coldest.temp}°C
- **Warmest decade**: ${s.warmestDecade.decade} averaging ${s.warmestDecade.avg}°C
- **Total change**: ${s.totalChange > 0 ? '+' : ''}${s.totalChange}°C across the full period

## Anomalies
${a.total} statistically significant anomalies detected: ${a.warm} warm anomalies and ${a.cold} cold anomalies (threshold: 1.5 standard deviations from the mean).

## Risk Assessment
**${r.level}** (${r.score}/100) — Warming trend contributes ${r.trendScore}/40, temperature variability ${r.variabilityScore}/30, and acceleration ${r.accelerationScore}/30 to the overall risk score.

## Projections
Based on linear trend extrapolation, temperatures are projected to reach ${proj50.predicted ?? '?'}°C in 50 years (95% CI: ${proj50.lower ?? '?'}–${proj50.upper ?? '?'}°C).

*Analysis generated from pre-computed statistics. AI narrative was unavailable.*`;
}

function computeClimateStats() {
    const ck = cacheGet('climate_stats_full');
    if (ck) return ck;

    const rows = loadClimateCSV();
    const firstYear = rows[0]?.year || 1750;
    const lastYear = rows.at(-1)?.year || 2015;
    const result = computeRangeStats(firstYear, lastYear);
    if (result) cacheSet('climate_stats_full', result, CLIMATE_CACHE_TTL);
    return result;
}

// =====================================================================
//  API ENDPOINTS
// =====================================================================

// ── Health check ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', model: GEMINI_MODEL, hasKey: Boolean(GEMINI_API_KEY), hasSupabase: Boolean(supabase) });
});

// ══════════════════════════════════════════════════════════════════════════
// ★ Analyze Climate — "Compute First, Narrate Later"
// ══════════════════════════════════════════════════════════════════════════
// Phase 1: Compute ALL statistics from CSV (instant, zero tokens)
// Phase 2: Build a ~500-char digest from the stats
// Phase 3: Send only the digest to Gemini for narrative analysis (~200 in tokens)
// Fallback: If Gemini is unavailable, return stats + offline narrative
// ══════════════════════════════════════════════════════════════════════════
app.post('/api/analyze-climate', async (req, res) => {
    try {
        const { startYear, endYear } = req.body;
        if (!startYear || !endYear) {
            return res.status(400).json({ error: 'startYear and endYear are required.' });
        }

        const start = parseInt(startYear, 10);
        const end = parseInt(endYear, 10);
        if (isNaN(start) || isNaN(end) || start > end) {
            return res.status(400).json({ error: 'Invalid year range.' });
        }

        // Check cache first
        const ck = `analyze_climate:${start}:${end}`;
        const cached = cacheGet(ck);
        if (cached) return res.json(cached);

        // ── Phase 1: Compute stats from CSV (instant, 0 tokens) ──
        const stats = computeRangeStats(start, end);
        if (!stats) {
            return res.status(404).json({ error: `No data found for ${start}–${end}.` });
        }

        const meta = {
            startYear: start,
            endYear: end,
            monthlyRecords: stats.stats.monthlyRecords,
            yearlyRecords: stats.stats.totalRecords,
            source: 'csv/GlobalTemperatures',
            tokenStrategy: 'pre-aggregated-digest',
        };

        // ── Phase 2: Build compact digest (~500 chars vs ~16,000 chars of raw data) ──
        const digest = buildStatsDigest(stats);

        // ── Phase 3: Send tiny digest to Gemini (if available) ──
        let analysis;
        if (genai) {
            const prompt = `You are a climate scientist. Below are PRE-COMPUTED statistics from ${stats.stats.monthlyRecords} monthly temperature records (${start}–${end}). All numbers are already calculated — do NOT recalculate.

${digest}

Write a concise Markdown analysis with these sections:
## Summary (2-3 sentences on the overall trend)
## Key Trends (3-5 bullet points, reference specific values)
## Anomalies (notable years and their significance)
## Risk Assessment (use the pre-computed risk score and interpret it)
## Local Implications (agriculture, water, health, extreme weather)
## Data Quality Notes (any caveats based on the period/uncertainty)

Be precise. Reference the actual numbers above. Do NOT invent data.`;

            try {
                analysis = await callGemini(prompt, { maxTokens: 1024 });
            } catch (err) {
                console.warn('Gemini unavailable for climate analysis, using offline narrative:', err.message);
                analysis = buildOfflineClimateNarrative(stats);
            }
        } else {
            analysis = buildOfflineClimateNarrative(stats);
        }

        const result = { analysis, stats, meta };
        cacheSet(ck, result, CLIMATE_CACHE_TTL);
        res.json(result);
    } catch (err) {
        console.error('analyze-climate error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
});

// ── Range Stats endpoint (pure computation, zero tokens) ─────────────────
app.get('/api/climate/range-stats', (req, res) => {
    try {
        const start = parseInt(req.query.start, 10);
        const end = parseInt(req.query.end, 10);
        if (isNaN(start) || isNaN(end) || start > end) {
            return res.status(400).json({ error: 'Invalid start/end query parameters.' });
        }
        const stats = computeRangeStats(start, end);
        if (!stats) return res.status(404).json({ error: `No data for ${start}–${end}.` });
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════
//  Existing endpoints (ported from Python)
// ══════════════════════════════════════════════════════════════════════════

// ── 1. Environmental Analysis ────────────────────────────────────────────
app.post('/api/ai/analyze-environment', async (req, res) => {
    const sensor = req.body?.sensorData || {};
    const ck = cacheKey('env', sensor);
    const cached = cacheGet(ck);
    if (cached) return res.json(cached);

    const envScore = computeEnvScore(sensor);
    const line = sensorSummary(sensor);
    const prompt = `Environmental snapshot (score ${envScore}/100): ${line}\nGive: 1) 2-sentence summary 2) concerns list 3) 3 recommendations 4) 6h prediction.\nFormat: SUMMARY: … | CONCERNS: … | RECOMMENDATIONS: … | PREDICTION: …`;

    try {
        const text = await callGemini(prompt, { maxTokens: 512, lite: true });
        const result = { ...parseSections(text), envScore };
        cacheSet(ck, result);
        res.json(result);
    } catch {
        const result = { ...offlineAnalysis(sensor, envScore), envScore };
        res.json(result);
    }
});

// ── 2. Generate Report ───────────────────────────────────────────────────
app.post('/api/ai/generate-report', async (req, res) => {
    const sensor = req.body?.sensorData || {};
    const alerts = (req.body?.alerts || []).slice(0, 5);
    const envScore = computeEnvScore(sensor);
    const line = sensorSummary(sensor);
    const prompt = `Environmental report (score ${envScore}/100): ${line} Recent alerts: ${alerts.length}.\nGive: SUMMARY, CONCERNS, RECOMMENDATIONS, PREDICTION. Be concise.`;

    let analysis;
    try {
        const text = await callGemini(prompt, { maxTokens: 512, lite: true });
        analysis = parseSections(text);
    } catch {
        analysis = offlineAnalysis(sensor, envScore);
    }

    res.json({
        generatedAt: new Date().toISOString(), envScore, analysis,
        currentReadings: sensor, recentAlerts: alerts,
        aqiCategory: { label: classifyAqi(sensor?.air?.aqi || 0), color: '#10b981' },
    });
});

// ── 3. Analyze Trends ────────────────────────────────────────────────────
app.post('/api/ai/analyze-trends', async (req, res) => {
    const { sensorData: sensor = {}, computed = {} } = req.body || {};
    const ck = cacheKey('trends', req.body);
    const cached = cacheGet(ck);
    if (cached) return res.json(cached);

    const envScore = computed.envScore || computeEnvScore(sensor);
    const aqiTrend = computed.aqiTrend || 0;
    const tempTrend = computed.tempTrend || 0;
    const anomalyCount = computed.anomalyCount || 0;

    const prompt = `Env readings: ${sensorSummary(sensor)}\nComputed: AQI trend=${aqiTrend > 0 ? 'rising' : aqiTrend < 0 ? 'falling' : 'stable'}(${aqiTrend.toFixed(1)}), temp trend=${tempTrend > 0 ? 'rising' : tempTrend < 0 ? 'falling' : 'stable'}(${tempTrend.toFixed(1)}°C), score=${envScore}/100, anomalies=${anomalyCount}.\nReturn JSON: {trendSummary,airTrend:{direction,detail},tempTrend:{direction,detail},waterTrend:{direction,detail},forecast6h,forecast24h,confidence}. direction: improving|stable|worsening (air), rising|stable|cooling (temp), safe|caution|unsafe (water). confidence: high|medium|low. JSON only.`;

    try {
        const result = await callGemini(prompt, { jsonMode: true, maxTokens: 512, lite: true });
        cacheSet(ck, result);
        res.json(result);
    } catch {
        res.json({
            trendSummary: 'Unable to generate trend analysis.',
            airTrend: { direction: 'stable', detail: 'Insufficient data.' },
            tempTrend: { direction: 'stable', detail: 'Insufficient data.' },
            waterTrend: { direction: 'safe', detail: 'Parameters within normal range.' },
            forecast6h: 'Conditions expected to remain stable.',
            forecast24h: 'Monitor for changes.',
            confidence: 'low',
        });
    }
});

// ── 4. Predict Anomalies ─────────────────────────────────────────────────
app.post('/api/ai/predict-anomalies', async (req, res) => {
    const { sensorData: sensor = {}, historicalData = {} } = req.body || {};
    const hist = compactHistorical(historicalData, 72);
    const localAnoms = detectAnomalies(sensor, hist);

    const ck = cacheKey('anomalies', { sensor, anoms: localAnoms });
    const cached = cacheGet(ck);
    if (cached) { cached.localAnomalies = localAnoms; return res.json(cached); }

    const anomLines = localAnoms.map(a => a.message).join('; ') || 'None detected';
    const prompt = `Sensor: ${sensorSummary(sensor)}\nDetected anomalies: ${anomLines}\nPredict 3-5 potential anomalies for next 6-12h as JSON: {predictions:[{metric,risk(high|medium|low),prediction,timeframe,probability(0-1)}],overallRisk(high|medium|low),summary}. JSON only.`;

    try {
        const result = await callGemini(prompt, { jsonMode: true, maxTokens: 512, lite: true });
        result.localAnomalies = localAnoms;
        cacheSet(ck, result);
        res.json(result);
    } catch {
        const offline = buildOfflinePredictions(sensor, localAnoms);
        offline.localAnomalies = localAnoms;
        cacheSet(ck, offline);
        res.json(offline);
    }
});

// ── 5. Health Recommendations ────────────────────────────────────────────
app.post('/api/ai/health-recommendations', async (req, res) => {
    const { sensorData: sensor = {}, historicalData = {}, anomalyMessages = [] } = req.body || {};
    const hist = compactHistorical(historicalData, 48);
    const ck = cacheKey('health', sensor);
    const cached = cacheGet(ck);
    if (cached) return res.json(cached);

    const envScore = computeEnvScore(sensor);
    const aqi = sensor?.air?.aqi || 0;
    const prompt = `Env score:${envScore}/100, AQI:${aqi}(${classifyAqi(aqi)}), readings:${sensorSummary(sensor)}, recentPoints:${hist.points || 0}, anomalies:${anomalyMessages.join('; ') || 'none'}.\nReturn JSON: {urgentActions:[str],healthAdvisory:{category(safe|caution|warning|danger),message},recommendations:[{title,detail,icon(air|water|sun|health|indoor|outdoor),priority(high|medium|low)}],vulnerableGroups:[str],exerciseAdvice:str}. 4-6 recommendations. JSON only.`;

    try {
        const result = await callGemini(prompt, { jsonMode: true, maxTokens: 768 });
        cacheSet(ck, result);
        res.json(result);
    } catch {
        res.json({
            urgentActions: [], healthAdvisory: { category: 'safe', message: 'Conditions are normal.' },
            recommendations: [{ title: 'Stay Informed', detail: 'Monitor conditions regularly.', icon: 'health', priority: 'low' }],
            vulnerableGroups: [], exerciseAdvice: 'Outdoor exercise appears safe in current conditions.',
        });
    }
});

// ── 6. Climate Policy Brief ──────────────────────────────────────────────
app.post('/api/ai/climate-policy-brief', async (req, res) => {
    const ck = cacheKey('climate_brief', {});
    const cached = cacheGet(ck);
    if (cached) return res.json(cached);

    let cs;
    try { cs = computeClimateStats(); } catch { return res.status(404).json({ error: 'Climate data file not found' }); }

    // Use the shared digest builder — compact ~500 chars instead of hand-built prompt data
    const digest = buildStatsDigest(cs);

    const prompt = `Climate stats digest:\n${digest}\nReturn JSON policy brief: {executiveSummary,keyRisks:[{risk,evidence,urgency(immediate|short-term|long-term)}],policyRecommendations:[{action,rationale,timeline,impact(high|medium|low)}],dataLimitations:[str],confidenceLevel(high|medium|low),confidenceExplanation}. 3-4 risks, 3-5 recs. JSON only.`;

    try {
        const result = await callGemini(prompt, { jsonMode: true, maxTokens: 1024 });
        cacheSet(ck, result, CLIMATE_CACHE_TTL);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: `AI generation failed: ${err.message}` });
    }
});

// ── 7. Air Quality Recommendations ───────────────────────────────────────
app.post('/api/ai/air-quality-recommendations', async (req, res) => {
    const air = req.body?.air || {};
    const ck = cacheKey('aq_recs', air);
    const cached = cacheGet(ck);
    if (cached) return res.json(cached);

    const aqi = air.aqi || 0;
    const prompt = `AQI:${aqi}(${classifyAqi(aqi)}) PM2.5:${air.pm25 ?? '?'} PM10:${air.pm10 ?? '?'} O3:${air.o3 ?? '?'} NO2:${air.no2 ?? '?'} SO2:${air.so2 ?? '?'} CO:${air.co ?? '?'}.\nReturn JSON array of 4-6 health recommendations: [{icon:'emoji',text:'one sentence'}]. JSON only.`;

    try {
        let result = await callGemini(prompt, { jsonMode: true, maxTokens: 384, lite: true });
        if (result && !Array.isArray(result)) result = result.recommendations || [result];
        const recs = { recommendations: result };
        cacheSet(ck, recs);
        res.json(recs);
    } catch {
        res.json({
            recommendations: [
                { icon: 'run', text: aqi <= 50 ? 'Air quality is ideal for outdoor activities.' : 'Limit outdoor physical activities.' },
                { icon: 'window', text: aqi <= 50 ? 'Great time to ventilate your home.' : 'Keep windows closed.' },
                { icon: 'mask', text: aqi <= 100 ? 'No mask needed.' : 'Wear an N95 mask outdoors.' },
                { icon: 'water', text: 'Stay well hydrated.' },
            ]
        });
    }
});

// ── 8. Climate Data (pre-processed, no AI) ───────────────────────────────
app.get('/api/climate/data', (_req, res) => {
    try {
        res.json(computeClimateStats());
    } catch {
        res.status(404).json({ error: 'Climate data file not found' });
    }
});

// ── Start ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n  🌿 EcoMonitor server running on http://localhost:${PORT}`);
    console.log(`  ├─ Gemini: ${GEMINI_API_KEY ? '✓ configured' : '✗ missing GEMINI_API_KEY'}`);
    console.log(`  ├─ Supabase: ${supabase ? '✓ configured' : '✗ missing env vars'}`);
    console.log(`  └─ Model: ${GEMINI_MODEL}\n`);
});
