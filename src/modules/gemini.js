/**
 * EcoMonitor — Thin REST client for the Python backend.
 * All Gemini calls and heavy data processing now happen server-side.
 */

import CONFIG from './config.js';

class GeminiAI {
    constructor() {
        this.apiUrl = CONFIG.BACKEND.API_URL;
        this.isConfigured = true; // Always ready — backend holds the key
        this._cache = new Map();          // client-side response cache
        this._cacheMaxAge = 5 * 60_000;   // 5 min client cache
        this._inflight = new Map();       // dedup concurrent identical requests
    }

    _compactHistoricalData(historicalData, maxPoints = 60) {
        if (!historicalData || typeof historicalData !== 'object') return {};

        const numericKeys = ['aqi', 'temperature', 'humidity', 'waterPh'];
        const compact = {};

        for (const key of numericKeys) {
            const arr = Array.isArray(historicalData[key]) ? historicalData[key] : [];
            compact[key] = arr.slice(-maxPoints).map((value) => {
                const parsed = Number(value);
                return Number.isFinite(parsed) ? Number(parsed.toFixed(3)) : null;
            }).filter((value) => value !== null);
        }

        const timestamps = Array.isArray(historicalData.timestamps) ? historicalData.timestamps : [];
        compact.timestamps = timestamps.slice(-maxPoints);
        compact.points = compact.aqi.length;

        return compact;
    }

    _compactAnomalyMessages(anomalyMessages, maxItems = 8, maxCharsPerItem = 120) {
        if (!Array.isArray(anomalyMessages)) return [];
        return anomalyMessages
            .slice(0, maxItems)
            .map((msg) => String(msg || '').trim())
            .filter(Boolean)
            .map((msg) => (msg.length > maxCharsPerItem ? `${msg.slice(0, maxCharsPerItem)}…` : msg));
    }

    /* ── Generic backend fetch helper with caching + dedup ───────── */
    async _post(endpoint, body = {}) {
        const cacheKey = endpoint + '::' + JSON.stringify(body);

        // Return cached result if fresh
        const cached = this._cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < this._cacheMaxAge) {
            return cached.data;
        }

        // Dedup: if identical request is already in-flight, wait for it
        if (this._inflight.has(cacheKey)) {
            return this._inflight.get(cacheKey);
        }

        const promise = (async () => {
            const res = await fetch(`${this.apiUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Backend ${endpoint} failed: ${res.status} — ${text}`);
            }
            const data = await res.json();
            this._cache.set(cacheKey, { data, ts: Date.now() });
            return data;
        })();

        this._inflight.set(cacheKey, promise);
        try {
            return await promise;
        } finally {
            this._inflight.delete(cacheKey);
        }
    }

    async _get(endpoint) {
        const res = await fetch(`${this.apiUrl}${endpoint}`);
        if (!res.ok) throw new Error(`Backend ${endpoint} failed: ${res.status}`);
        return res.json();
    }

    /* ── Public API (same method signatures components expect) ───── */

    /** 1. Environmental analysis — used by AppContext.refreshAIAnalysis */
    async analyzeEnvironmentalData(sensorData, _historicalData) {
        try {
            return await this._post('/api/ai/analyze-environment', { sensorData });
        } catch (err) {
            console.error('Backend analyze-environment error:', err);
            return this._offlineAnalysis(sensorData);
        }
    }

    /** 2. Full report — used by AppContext.exportReport */
    async generateReport(sensorData, _historicalData, alerts) {
        try {
            return await this._post('/api/ai/generate-report', { sensorData, alerts });
        } catch (err) {
            console.error('Backend generate-report error:', err);
            const analysis = this._offlineAnalysis(sensorData);
            return { generatedAt: new Date().toISOString(), analysis, currentReadings: sensorData, recentAlerts: (alerts || []).slice(0, 5) };
        }
    }

    /** 3. Trend analysis — used by AIInsightsView */
    async analyzeTrends(sensorData, computed) {
        return this._post('/api/ai/analyze-trends', { sensorData, computed });
    }

    /** 4. Anomaly prediction — used by AIInsightsView */
    async predictAnomalies(sensorData, historicalData) {
        const compactHistoricalData = this._compactHistoricalData(historicalData, 72);
        return this._post('/api/ai/predict-anomalies', { sensorData, historicalData: compactHistoricalData });
    }

    /** 5. Health recommendations — used by AIInsightsView */
    async healthRecommendations(sensorData, historicalData, anomalyMessages) {
        const compactHistoricalData = this._compactHistoricalData(historicalData, 48);
        const compactMessages = this._compactAnomalyMessages(anomalyMessages);
        return this._post('/api/ai/health-recommendations', {
            sensorData,
            historicalData: compactHistoricalData,
            anomalyMessages: compactMessages,
        });
    }

    /** 6. Climate policy brief — used by ClimateTrendsView */
    async climatePolicyBrief() {
        return this._post('/api/ai/climate-policy-brief', {});
    }

    /** 7. Air-quality recommendations — used by AirQualityView */
    async airQualityRecommendations(air) {
        return this._post('/api/ai/air-quality-recommendations', { air });
    }

    /** Pre-processed climate data (pandas, no AI) */
    async getClimateData() {
        return this._get('/api/climate/data');
    }

    /** Health check */
    async healthCheck() {
        return this._get('/api/health');
    }

    /* ── Offline fallback (no backend) ─────────────────────────────── */
    _offlineAnalysis(sensorData) {
        const aqi = sensorData?.air?.aqi ?? 0;
        const temp = parseFloat(sensorData?.weather?.temperature ?? 20);
        const ph = parseFloat(sensorData?.water?.ph ?? 7);
        const concerns = [];
        const recommendations = [];

        if (aqi <= 50) { /* good */ }
        else if (aqi <= 100) { recommendations.push('Sensitive individuals should limit prolonged outdoor exertion.'); }
        else if (aqi <= 150) { concerns.push(`Elevated AQI of ${aqi}`); recommendations.push('Reduce outdoor activities. Consider an N95 mask.'); }
        else { concerns.push(`High AQI of ${aqi}`); recommendations.push('Avoid outdoor activities. Keep windows closed.'); }

        if (temp > 35) { concerns.push('Heat advisory'); recommendations.push('Stay hydrated and avoid sun exposure.'); }
        if (ph < 6.5 || ph > 8.5) { concerns.push(`Water pH ${ph} outside safe range`); recommendations.push('Avoid untreated water.'); }

        if (!recommendations.length) recommendations.push('Continue monitoring conditions.');

        return {
            summary: `AQI ${aqi}, Temp ${temp}°C, pH ${ph}. ${concerns.length ? concerns.join('. ') + '.' : 'All normal.'}`,
            concerns,
            recommendations,
            prediction: 'Conditions expected to remain stable in the next 6 hours.',
        };
    }
}

export default GeminiAI;
