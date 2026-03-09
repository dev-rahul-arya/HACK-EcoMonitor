import { useState, useCallback, useMemo, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { useApp } from '../context/AppContext';

/* Inline SVG icon helpers — replace all emojis with consistent stroke icons */
const ico = (paths, size = 16) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }}>{paths}</svg>
);
const IcoWind = (s = 16) => ico(<><path d="M17.7 7.7a7.5 7.5 0 1 0-10.6 10.6"/><path d="M8 16h.01"/><path d="M12 12h.01"/><path d="M16 8h.01"/></>, s);
const IcoThermo = (s = 16) => ico(<><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/></>, s);
const IcoDrop = (s = 16) => ico(<><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></>, s);
const IcoClock = (s = 16) => ico(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, s);
const IcoCalendar = (s = 16) => ico(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>, s);
const IcoSearch = (s = 16) => ico(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>, s);
const IcoCpu = (s = 16) => ico(<><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></>, s);
const IcoAlert = (s = 16) => ico(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>, s);
const IcoZap = (s = 16) => ico(<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>, s);
const IcoShield = (s = 16) => ico(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>, s);
const IcoHeart = (s = 16) => ico(<><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></>, s);
const IcoSun = (s = 16) => ico(<><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>, s);
const IcoHome = (s = 16) => ico(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>, s);
const IcoTree = (s = 16) => ico(<><path d="M17 14l3-6H4l3 6"/><path d="M15 18l2-4H7l2 4"/><line x1="12" y1="22" x2="12" y2="18"/></>, s);
const IcoRun = (s = 16) => ico(<><circle cx="12" cy="5" r="2"/><path d="M4 17l4-4 2 2 4-4 2 2"/></>, s);
const IcoClipboard = (s = 16) => ico(<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></>, s);

const ACTIONS = {
    trends: { label: 'Analyze Trends', icon: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></> },
    anomalies: { label: 'Predict Anomalies', icon: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></> },
    recommendations: { label: 'Health & Safety', icon: <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></> },
    report: { label: 'Full Report', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></> },
};

/* ---- Local computation helpers ---- */
function classifyAQI(aqi) {
    if (aqi <= 50) return { label: 'Good', color: '#10b981' };
    if (aqi <= 100) return { label: 'Moderate', color: '#f59e0b' };
    if (aqi <= 150) return { label: 'Unhealthy (SG)', color: '#f97316' };
    if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' };
    return { label: 'Hazardous', color: '#7f1d1d' };
}

function detectLocalAnomalies(currentData, historicalData) {
    const anomalies = [];
    const { air, weather, water } = currentData;

    // AQI spike detection
    const aqiHistory = historicalData.aqi || [];
    if (aqiHistory.length >= 3) {
        const recentAvg = aqiHistory.slice(-5).reduce((a, b) => a + b, 0) / Math.min(aqiHistory.length, 5);
        const aqiDelta = ((air.aqi - recentAvg) / (recentAvg || 1)) * 100;
        if (Math.abs(aqiDelta) > 15) {
            anomalies.push({
                metric: 'AQI',
                value: air.aqi,
                baseline: +recentAvg.toFixed(0),
                delta: +aqiDelta.toFixed(1),
                severity: Math.abs(aqiDelta) > 40 ? 'critical' : 'warning',
                direction: aqiDelta > 0 ? 'rise' : 'drop',
                message: `AQI ${aqiDelta > 0 ? 'spiked' : 'dropped'} ${Math.abs(aqiDelta).toFixed(0)}% from recent baseline`,
            });
        }
    }

    // Temperature anomaly
    const tempHistory = historicalData.temperature || [];
    if (tempHistory.length >= 3) {
        const tempAvg = tempHistory.slice(-5).reduce((a, b) => a + b, 0) / Math.min(tempHistory.length, 5);
        const tempDelta = Math.abs(parseFloat(weather.temperature) - tempAvg);
        if (tempDelta > 3) {
            anomalies.push({
                metric: 'Temperature',
                value: parseFloat(weather.temperature),
                baseline: +tempAvg.toFixed(1),
                delta: +tempDelta.toFixed(1),
                severity: tempDelta > 6 ? 'critical' : 'warning',
                direction: parseFloat(weather.temperature) > tempAvg ? 'rise' : 'drop',
                message: `Temperature deviates ${tempDelta.toFixed(1)}°C from recent average`,
            });
        }
    }

    // Water pH anomaly
    const ph = parseFloat(water.ph);
    if (ph < 6.5 || ph > 8.5) {
        anomalies.push({
            metric: 'Water pH',
            value: ph,
            baseline: 7.0,
            delta: +(ph - 7.0).toFixed(2),
            severity: ph < 6.0 || ph > 9.0 ? 'critical' : 'warning',
            direction: ph > 7 ? 'rise' : 'drop',
            message: `pH ${ph < 6.5 ? 'acidic' : 'alkaline'} — outside safe range (6.5-8.5)`,
        });
    }

    // Humidity anomaly
    const humidity = parseFloat(weather.humidity);
    if (humidity > 85 || humidity < 20) {
        anomalies.push({
            metric: 'Humidity',
            value: humidity,
            baseline: 50,
            delta: +(humidity - 50).toFixed(0),
            severity: humidity > 95 || humidity < 10 ? 'critical' : 'warning',
            direction: humidity > 50 ? 'rise' : 'drop',
            message: `Humidity ${humidity > 85 ? 'very high' : 'very low'} at ${humidity}%`,
        });
    }

    // PM2.5 anomaly
    if (parseFloat(air.pm25) > 35) {
        anomalies.push({
            metric: 'PM2.5',
            value: parseFloat(air.pm25),
            baseline: 12,
            delta: +(parseFloat(air.pm25) - 12).toFixed(1),
            severity: parseFloat(air.pm25) > 55 ? 'critical' : 'warning',
            direction: 'rise',
            message: `PM2.5 at ${air.pm25} μg/m³ exceeds WHO guideline (15 μg/m³)`,
        });
    }

    return anomalies;
}

function computeEnvironmentScore(data) {
    const { air, weather, water } = data;
    let score = 100;
    // Air quality penalty
    if (air.aqi > 50) score -= Math.min((air.aqi - 50) * 0.3, 30);
    // Temperature comfort
    const temp = parseFloat(weather.temperature);
    if (temp > 35 || temp < 5) score -= 10;
    else if (temp > 30 || temp < 10) score -= 5;
    // Water quality
    const ph = parseFloat(water.ph);
    if (ph < 6.5 || ph > 8.5) score -= 10;
    // UV risk
    if (parseFloat(weather.uvIndex) > 8) score -= 5;
    return Math.max(Math.round(score), 0);
}

/* ---- Trend mini-chart data from historical ---- */
function buildTrendChartData(historicalData) {
    const labels = historicalData.timestamps?.slice(-20) || [];
    return {
        labels: labels.map((_, i) => i + 1),
        datasets: [
            {
                label: 'AQI',
                data: (historicalData.aqi || []).slice(-20),
                borderColor: '#ef4444',
                borderWidth: 1.5,
                pointRadius: 2,
                tension: 0.3,
                yAxisID: 'y',
            },
            {
                label: 'Temperature (°C)',
                data: (historicalData.temperature || []).slice(-20),
                borderColor: '#f59e0b',
                borderWidth: 1.5,
                pointRadius: 2,
                tension: 0.3,
                yAxisID: 'y1',
            },
        ],
    };
}

const trendChartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#9ca3af', font: { size: 11 } } } },
    scales: {
        x: { display: false },
        y: { position: 'left', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280', font: { size: 10 } }, title: { display: true, text: 'AQI', color: '#6b7280', font: { size: 10 } } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#6b7280', font: { size: 10 } }, title: { display: true, text: '°C', color: '#6b7280', font: { size: 10 } } },
    },
};

/* ---- THE COMPONENT ---- */
export default function AIInsightsView() {
    const { currentData, historicalData, aiAnalysis, aiLoading, refreshAIAnalysis, exportReport, showToast, aiRef, sensorsRef } = useApp();

    const [activeAction, setActiveAction] = useState(() => {
        try { const cached = localStorage.getItem('eco_ai_active_action'); return cached || null; } catch { return null; }
    });
    const [actionLoading, setActionLoading] = useState(false);
    const [actionResult, setActionResult] = useState(() => {
        try { const cached = localStorage.getItem('eco_ai_action_result'); return cached ? JSON.parse(cached) : null; } catch { return null; }
    });
    const [cooldown, setCooldown] = useState(0); // cooldown seconds remaining
    const [loadingStep, setLoadingStep] = useState(0); // progress stepper for UX

    const data = currentData || {};
    const aqiInfo = classifyAQI(data.air?.aqi ?? 0);
    const envScore = useMemo(() => currentData ? computeEnvironmentScore(currentData) : 0, [currentData]);
    const localAnomalies = useMemo(() => currentData ? detectLocalAnomalies(currentData, historicalData) : [], [currentData, historicalData]);
    const trendData = useMemo(() => buildTrendChartData(historicalData), [historicalData]);

    const AI_STEPS = [
        { label: 'Collecting sensor data', icon: '1' },
        { label: 'Computing local analytics', icon: '2' },
        { label: 'Sending to Gemini AI', icon: '3' },
        { label: 'Processing response', icon: '4' },
    ];

    /* ---- Action handlers ---- */
    const handleAction = useCallback(async (type) => {
        setActiveAction(type);
        setActionLoading(true);
        setActionResult(null);
        setLoadingStep(0);

        try {
            // Step 1: Collect data
            setLoadingStep(1);
            const sensorData = currentData || sensorsRef.current.generateSensorData();
            const hist = sensorsRef.current.getHistoricalData();

            // Step 2: Local computation
            setLoadingStep(2);
            const localAnoms = detectLocalAnomalies(sensorData, hist);
            const score = computeEnvironmentScore(sensorData);

            // Step 3: AI call
            setLoadingStep(3);

            if (type === 'trends') {
                const aqiTrend = (hist.aqi?.length >= 3) ? (hist.aqi[hist.aqi.length - 1] - hist.aqi[0]) : 0;
                const tempTrend = (hist.temperature?.length >= 3) ? (hist.temperature[hist.temperature.length - 1] - hist.temperature[0]) : 0;
                const parsed = await aiRef.current.analyzeTrends(sensorData, {
                    envScore: score,
                    aqiTrend,
                    tempTrend,
                    anomalyCount: localAnoms.length,
                });
                setLoadingStep(4);
                setActionResult({ type: 'trends', data: parsed, local: { aqiTrend, tempTrend, score, anomalyCount: localAnoms.length } });

            } else if (type === 'anomalies') {
                const parsed = await aiRef.current.predictAnomalies(sensorData, hist);
                setLoadingStep(4);
                setActionResult({ type: 'anomalies', data: parsed, local: localAnoms });

            } else if (type === 'recommendations') {
                const parsed = await aiRef.current.healthRecommendations(
                    sensorData,
                    hist,
                    localAnoms.map(a => a.message),
                );
                setLoadingStep(4);
                setActionResult({ type: 'recommendations', data: parsed });

            } else if (type === 'report') {
                const analysis = await aiRef.current.analyzeEnvironmentalData(sensorData, hist);
                setLoadingStep(4);
                setActionResult({
                    type: 'report',
                    data: {
                        generatedAt: new Date().toLocaleString(),
                        envScore: score,
                        sensorData,
                        analysis,
                        anomalies: localAnoms,
                        aqiCategory: classifyAQI(sensorData.air.aqi),
                    },
                });
            }
        } catch (err) {
            console.error('AI action error:', err);
            setActionResult({ type, error: `Analysis failed: ${err.message}` });
        } finally {
            setActionLoading(false);
            setLoadingStep(0);
            setCooldown(30);
        }
    }, [currentData, sensorsRef, aiRef]);

    // Cooldown countdown timer
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown(prev => {
                if (prev <= 1) { clearInterval(timer); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    // Persist AI action results to localStorage
    useEffect(() => {
        if (actionResult && !actionResult.error) {
            try {
                localStorage.setItem('eco_ai_action_result', JSON.stringify(actionResult));
                localStorage.setItem('eco_ai_active_action', actionResult.type || '');
            } catch { /* storage full */ }
        }
    }, [actionResult]);

    const handleExport = useCallback(() => {
        if (actionResult?.type === 'report' && actionResult.data) {
            const blob = new Blob([JSON.stringify(actionResult.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ecomonitor-report-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('success', 'Report Exported', 'Report downloaded successfully');
        } else {
            exportReport();
        }
    }, [actionResult, exportReport, showToast]);

    /* ---- Render helpers ---- */
    const renderTrendDirection = (dir) => {
        const colors = { improving: '#10b981', stable: '#3b82f6', worsening: '#ef4444', rising: '#f59e0b', cooling: '#3b82f6', safe: '#10b981', caution: '#f59e0b', unsafe: '#ef4444' };
        return <span className="trend-badge" style={{ background: `${colors[dir] || '#6b7280'}22`, color: colors[dir] || '#6b7280' }}>{dir}</span>;
    };

    const renderOutput = () => {
        if (actionLoading) {
            return (
                <div className="ai-output-area">
                    <div className="ai-progress-stepper">
                        {AI_STEPS.map((step, i) => {
                            const stepNum = i + 1;
                            const isActive = loadingStep === stepNum;
                            const isDone = loadingStep > stepNum;
                            return (
                                <div key={i} className={`ai-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                                    <div className="ai-step-indicator">
                                        {isDone ? (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 12l2 2 4-4" /></svg>
                                        ) : isActive ? (
                                            <div className="ai-step-spinner"></div>
                                        ) : (
                                            <span>{step.icon}</span>
                                        )}
                                    </div>
                                    <span className="ai-step-label">{step.label}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="ai-progress-bar">
                        <div className="ai-progress-fill" style={{ width: `${(loadingStep / AI_STEPS.length) * 100}%` }}></div>
                    </div>
                    <p className="ai-progress-text">{AI_STEPS[Math.min(loadingStep, AI_STEPS.length) - 1]?.label || 'Initializing...'}</p>
                </div>
            );
        }
        if (!actionResult) return null;
        if (actionResult.error) {
            return <div className="ai-output-area"><div className="ai-error-msg">{IcoAlert()} {actionResult.error}</div></div>;
        }

        const { type, data } = actionResult;

        if (type === 'trends') {
            return (
                <div className="ai-output-area">
                    <div className="ai-output-header">
                        <h3>Trend Analysis Results</h3>
                        <span className="ai-confidence">Confidence: <strong>{data.confidence}</strong></span>
                    </div>
                    <p className="ai-output-summary">{data.trendSummary}</p>
                    <div className="ai-trend-cards">
                        <div className="ai-trend-card">
                            <div className="ai-trend-card-top">
                                <span className="ai-trend-label">{IcoWind()} Air Quality</span>
                                {renderTrendDirection(data.airTrend?.direction)}
                            </div>
                            <p>{data.airTrend?.detail}</p>
                        </div>
                        <div className="ai-trend-card">
                            <div className="ai-trend-card-top">
                                <span className="ai-trend-label">{IcoThermo()} Temperature</span>
                                {renderTrendDirection(data.tempTrend?.direction)}
                            </div>
                            <p>{data.tempTrend?.detail}</p>
                        </div>
                        <div className="ai-trend-card">
                            <div className="ai-trend-card-top">
                                <span className="ai-trend-label">{IcoDrop()} Water Quality</span>
                                {renderTrendDirection(data.waterTrend?.direction)}
                            </div>
                            <p>{data.waterTrend?.detail}</p>
                        </div>
                    </div>
                    <div className="ai-forecast-strip">
                        <div className="ai-forecast-item">
                            <span className="forecast-label">{IcoClock()} 6-Hour Forecast</span>
                            <p>{data.forecast6h}</p>
                        </div>
                        <div className="ai-forecast-item">
                            <span className="forecast-label">{IcoCalendar()} 24-Hour Forecast</span>
                            <p>{data.forecast24h}</p>
                        </div>
                    </div>
                    {/* Mini trend chart */}
                    {trendData.datasets[0].data.length > 0 && (
                        <div className="ai-mini-chart">
                            <h4>Sensor History (last 20 readings)</h4>
                            <div style={{ height: 160 }}><Line data={trendData} options={trendChartOpts} /></div>
                        </div>
                    )}
                </div>
            );
        }

        if (type === 'anomalies') {
            return (
                <div className="ai-output-area">
                    <div className="ai-output-header">
                        <h3>Anomaly Detection & Prediction</h3>
                        <span className={`ai-risk-pill ${data.overallRisk}`}>{data.overallRisk} risk</span>
                    </div>

                    {/* Local computed anomalies */}
                    {actionResult.local?.length > 0 && (
                        <div className="ai-section-block">
                            <h4>{IcoSearch()} Detected by Our Algorithms</h4>
                            <div className="ai-anomaly-list">
                                {actionResult.local.map((a, i) => (
                                    <div key={i} className={`ai-anomaly-item ${a.severity}`}>
                                        <div className="ai-anomaly-top">
                                            <span className="ai-anomaly-metric">{a.metric}</span>
                                            <span className={`severity-badge ${a.severity}`}>{a.severity}</span>
                                        </div>
                                        <p>{a.message}</p>
                                        <div className="ai-anomaly-detail">
                                            <span>Current: <strong>{a.value}</strong></span>
                                            <span>Baseline: <strong>{a.baseline}</strong></span>
                                            <span className={`delta ${a.direction}`}>{a.direction === 'rise' ? '↑' : '↓'} {Math.abs(a.delta)}{a.metric === 'AQI' ? '%' : ''}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* AI predictions */}
                    <div className="ai-section-block">
                        <h4>{IcoCpu()} AI-Predicted Anomalies (Next 6-12h)</h4>
                        <p className="ai-output-summary">{data.summary}</p>
                        <div className="ai-prediction-list">
                            {data.predictions?.map((p, i) => (
                                <div key={i} className={`ai-prediction-card ${p.risk}`}>
                                    <div className="prediction-header">
                                        <span className="prediction-metric">{p.metric}</span>
                                        <span className={`risk-pill ${p.risk}`}>{p.risk}</span>
                                    </div>
                                    <p>{p.prediction}</p>
                                    <div className="prediction-footer">
                                        <span>{IcoClock()} {p.timeframe}</span>
                                        <div className="probability-bar">
                                            <div className="probability-fill" style={{ width: `${(p.probability || 0) * 100}%` }}></div>
                                            <span>{Math.round((p.probability || 0) * 100)}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        if (type === 'recommendations') {
            const catColors = { safe: '#10b981', caution: '#f59e0b', warning: '#f97316', danger: '#ef4444' };
            const iconMap = { air: IcoWind(20), water: IcoDrop(20), sun: IcoSun(20), health: IcoHeart(20), indoor: IcoHome(20), outdoor: IcoTree(20) };
            return (
                <div className="ai-output-area">
                    <div className="ai-output-header">
                        <h3>Health & Safety Advisory</h3>
                    </div>
                    {data.healthAdvisory && (
                        <div className="health-advisory-banner" style={{ borderColor: catColors[data.healthAdvisory.category] || '#6b7280' }}>
                            <span className="advisory-cat" style={{ color: catColors[data.healthAdvisory.category] }}>{data.healthAdvisory.category?.toUpperCase()}</span>
                            <p>{data.healthAdvisory.message}</p>
                        </div>
                    )}

                    {data.urgentActions?.length > 0 && (
                        <div className="ai-section-block urgent">
                            <h4>{IcoZap()} Urgent Actions</h4>
                            <ul className="urgent-list">{data.urgentActions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                        </div>
                    )}

                    <div className="ai-rec-cards">
                        {data.recommendations?.map((r, i) => (
                            <div key={i} className={`ai-rec-card priority-${r.priority}`}>
                                <div className="ai-rec-icon">{iconMap[r.icon] || IcoClipboard(20)}</div>
                                <div className="ai-rec-body">
                                    <strong>{r.title}</strong>
                                    <p>{r.detail}</p>
                                </div>
                                <span className={`priority-tag ${r.priority}`}>{r.priority}</span>
                            </div>
                        ))}
                    </div>

                    {data.vulnerableGroups?.length > 0 && (
                        <div className="ai-section-block">
                            <h4>{IcoShield()} Vulnerable Groups</h4>
                            <ul className="vulnerable-list">{data.vulnerableGroups.map((g, i) => <li key={i}>{g}</li>)}</ul>
                        </div>
                    )}

                    {data.exerciseAdvice && (
                        <div className="ai-exercise-box">
                            <span>{IcoRun()} Exercise Advice:</span> {data.exerciseAdvice}
                        </div>
                    )}
                </div>
            );
        }

        if (type === 'report') {
            const rpt = data;
            return (
                <div className="ai-output-area">
                    <div className="ai-output-header">
                        <h3>Environmental Intelligence Report</h3>
                        <button className="report-download-btn" onClick={handleExport}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download JSON
                        </button>
                    </div>

                    {/* Score banner */}
                    <div className="report-score-banner">
                        <div className="report-score-ring" style={{ '--score-color': rpt.envScore >= 70 ? '#10b981' : rpt.envScore >= 40 ? '#f59e0b' : '#ef4444' }}>
                            <span className="score-number">{rpt.envScore}</span>
                            <span className="score-label">/ 100</span>
                        </div>
                        <div className="report-score-details">
                            <span className="report-score-title">Environment Score</span>
                            <span className="report-score-desc">{rpt.envScore >= 70 ? 'Good — conditions are within safe parameters' : rpt.envScore >= 40 ? 'Moderate — some metrics need attention' : 'Poor — immediate action recommended'}</span>
                        </div>
                    </div>

                    {/* Key metrics */}
                    <div className="report-metrics-row">
                        <div className="report-metric-card">
                            <span className="report-metric-label">Generated</span>
                            <span className="report-metric-value">{rpt.generatedAt}</span>
                        </div>
                        <div className="report-metric-card">
                            <span className="report-metric-label">Air Quality</span>
                            <span className="report-metric-value" style={{ color: rpt.aqiCategory.color }}>{rpt.sensorData.air.aqi} <small>({rpt.aqiCategory.label})</small></span>
                        </div>
                        <div className="report-metric-card">
                            <span className="report-metric-label">Temperature</span>
                            <span className="report-metric-value">{rpt.sensorData.weather?.temperature ?? '--'}°C</span>
                        </div>
                        <div className="report-metric-card">
                            <span className="report-metric-label">Water pH</span>
                            <span className="report-metric-value">{rpt.sensorData.water?.ph ?? '--'}</span>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="report-card">
                        <div className="report-card-header">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            <h4>Summary</h4>
                        </div>
                        <p className="report-card-body">{rpt.analysis?.summary || 'No summary available.'}</p>
                    </div>

                    {/* Concerns */}
                    {rpt.analysis?.concerns?.length > 0 && (
                        <div className="report-card report-card-warn">
                            <div className="report-card-header">
                                {IcoAlert(18)}
                                <h4>Current Concerns</h4>
                                <span className="report-card-count">{rpt.analysis.concerns.length}</span>
                            </div>
                            <ul className="report-card-list">{rpt.analysis.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
                        </div>
                    )}

                    {/* Recommendations */}
                    {rpt.analysis?.recommendations?.length > 0 && (
                        <div className="report-card report-card-info">
                            <div className="report-card-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                <h4>Recommendations</h4>
                            </div>
                            <ul className="report-card-list">{rpt.analysis.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                        </div>
                    )}

                    {/* Prediction */}
                    {rpt.analysis?.prediction && (
                        <div className="report-card">
                            <div className="report-card-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                                <h4>Prediction</h4>
                            </div>
                            <p className="report-card-body">{rpt.analysis.prediction}</p>
                        </div>
                    )}

                    {/* Active Anomalies */}
                    {rpt.anomalies?.length > 0 && (
                        <div className="report-card report-card-warn">
                            <div className="report-card-header">
                                {IcoAlert(18)}
                                <h4>Active Anomalies</h4>
                                <span className="report-card-count">{rpt.anomalies.length}</span>
                            </div>
                            <ul className="report-card-list anomaly-list">{rpt.anomalies.map((a, i) => (
                                <li key={i}><strong>{a.metric}:</strong> {a.message}
                                    <span className={`anomaly-inline-badge ${a.severity}`}>{a.severity}</span>
                                </li>
                            ))}</ul>
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <section className="view active" id="view-ai-insights">
            <div className="view-content">
                <div className="ai-dashboard">

                    {/* Live status strip */}
                    <div className="ai-live-strip">
                        <div className="live-stat">
                            <span className="live-label">Environment Score</span>
                            <span className="live-value" style={{ color: envScore >= 70 ? '#10b981' : envScore >= 40 ? '#f59e0b' : '#ef4444' }}>{envScore}<small>/100</small></span>
                        </div>
                        <div className="live-stat">
                            <span className="live-label">Air Quality</span>
                            <span className="live-value" style={{ color: aqiInfo.color }}>{data.air?.aqi ?? '--'} <small>{aqiInfo.label}</small></span>
                        </div>
                        <div className="live-stat">
                            <span className="live-label">Anomalies</span>
                            <span className="live-value" style={{ color: localAnomalies.length > 0 ? '#ef4444' : '#10b981' }}>{localAnomalies.length} <small>detected</small></span>
                        </div>
                        <div className="live-stat">
                            <span className="live-label">Temperature</span>
                            <span className="live-value">{data.weather?.temperature ?? '--'}°C</span>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="ai-actions-grid">
                        {Object.entries(ACTIONS).map(([key, action]) => (
                            <button
                                key={key}
                                className={`ai-action-card ${activeAction === key ? 'active' : ''}`}
                                onClick={() => key === 'report' && activeAction === 'report' && actionResult ? handleExport() : handleAction(key)}
                                disabled={actionLoading || cooldown > 0}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{action.icon}</svg>
                                <span>{cooldown > 0 && !actionLoading ? <>{IcoClock()} {cooldown}s</> : action.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Dynamic output area */}
                    {renderOutput()}
                </div>
            </div>
        </section>
    );
}
