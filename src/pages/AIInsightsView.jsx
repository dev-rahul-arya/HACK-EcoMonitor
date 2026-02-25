import { useState, useCallback, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { useApp } from '../context/AppContext';

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

    const [activeAction, setActiveAction] = useState(null); // 'trends' | 'anomalies' | 'recommendations' | 'report'
    const [actionLoading, setActionLoading] = useState(false);
    const [actionResult, setActionResult] = useState(null);

    const data = currentData || {};
    const aqiInfo = classifyAQI(data.air?.aqi ?? 0);
    const envScore = useMemo(() => currentData ? computeEnvironmentScore(currentData) : 0, [currentData]);
    const localAnomalies = useMemo(() => currentData ? detectLocalAnomalies(currentData, historicalData) : [], [currentData, historicalData]);
    const trendData = useMemo(() => buildTrendChartData(historicalData), [historicalData]);

    /* ---- Action handlers ---- */
    const handleAction = useCallback(async (type) => {
        setActiveAction(type);
        setActionLoading(true);
        setActionResult(null);

        try {
            const sensorData = currentData || sensorsRef.current.generateSensorData();
            const hist = sensorsRef.current.getHistoricalData();
            const localAnoms = detectLocalAnomalies(sensorData, hist);
            const score = computeEnvironmentScore(sensorData);

            if (type === 'trends') {
                // Local trend computation + AI interpretation
                const aqiTrend = (hist.aqi?.length >= 3) ? (hist.aqi[hist.aqi.length - 1] - hist.aqi[0]) : 0;
                const tempTrend = (hist.temperature?.length >= 3) ? (hist.temperature[hist.temperature.length - 1] - hist.temperature[0]) : 0;
                const prompt = `You are an environmental data analyst. Based on our real-time monitoring system's computed analysis:

LIVE SENSOR READINGS:
- AQI: ${sensorData.air.aqi} (${classifyAQI(sensorData.air.aqi).label})
- PM2.5: ${sensorData.air.pm25} μg/m³ | PM10: ${sensorData.air.pm10} μg/m³
- O3: ${sensorData.air.o3} ppb | NO2: ${sensorData.air.no2} ppb | SO2: ${sensorData.air.so2} ppb | CO: ${sensorData.air.co} ppm
- Temperature: ${sensorData.weather.temperature}°C | Humidity: ${sensorData.weather.humidity}%
- Wind: ${sensorData.weather.windSpeed} km/h | UV: ${sensorData.weather.uvIndex}
- Water pH: ${sensorData.water.ph} | DO: ${sensorData.water.dissolvedOxygen} mg/L | Turbidity: ${sensorData.water.turbidity} NTU

OUR COMPUTED TREND ANALYSIS:
- AQI trend (last 20 readings): ${aqiTrend > 0 ? 'Rising' : aqiTrend < 0 ? 'Falling' : 'Stable'} (delta: ${aqiTrend.toFixed(1)})
- Temperature trend: ${tempTrend > 0 ? 'Rising' : tempTrend < 0 ? 'Falling' : 'Stable'} (delta: ${tempTrend.toFixed(1)}°C)
- Environment Score: ${score}/100
- Anomalies detected by our system: ${localAnoms.length} (${localAnoms.map(a => a.metric).join(', ') || 'none'})

Provide your response as JSON with this structure:
{
  "trendSummary": "2-3 sentence overview of the current environmental trends",
  "airTrend": {"direction": "improving|stable|worsening", "detail": "one sentence"},
  "tempTrend": {"direction": "rising|stable|cooling", "detail": "one sentence"},
  "waterTrend": {"direction": "safe|caution|unsafe", "detail": "one sentence"},
  "forecast6h": "What to expect in the next 6 hours",
  "forecast24h": "What to expect in the next 24 hours",
  "confidence": "high|medium|low"
}
Return ONLY valid JSON, no markdown.`;
                const parsed = await aiRef.current.callGeminiJSON(prompt);
                setActionResult({ type: 'trends', data: parsed, local: { aqiTrend, tempTrend, score, anomalyCount: localAnoms.length } });

            } else if (type === 'anomalies') {
                // Local anomaly detection + AI prediction
                const prompt = `You are an environmental anomaly prediction system. Our monitoring sensors have performed real-time anomaly detection using statistical thresholds.

DETECTED ANOMALIES FROM OUR ALGORITHMS:
${localAnoms.length > 0
    ? localAnoms.map(a => `- ${a.metric}: current=${a.value}, baseline=${a.baseline}, deviation=${a.delta}${a.metric === 'AQI' ? '' : a.metric === 'Temperature' ? '°C' : ''}, severity=${a.severity}, message="${a.message}"`).join('\n')
    : '- No anomalies detected by threshold analysis'}

CURRENT READINGS:
- AQI: ${sensorData.air.aqi} | PM2.5: ${sensorData.air.pm25} μg/m³
- Temperature: ${sensorData.weather.temperature}°C | Humidity: ${sensorData.weather.humidity}%
- Wind: ${sensorData.weather.windSpeed} km/h | Condition: ${sensorData.weather.condition}
- Water pH: ${sensorData.water.ph} | Turbidity: ${sensorData.water.turbidity} NTU

Based on the current readings and our anomaly detections, predict what could happen in the next 6-12 hours.

Provide your response as JSON:
{
  "predictions": [
    {"metric": "name", "risk": "high|medium|low", "prediction": "what might happen", "timeframe": "when", "probability": 0.0-1.0}
  ],
  "overallRisk": "high|medium|low",
  "summary": "2 sentence summary of predicted anomalies"
}
Return ONLY valid JSON, no markdown. Include 3-5 predictions.`;
                const parsed = await aiRef.current.callGeminiJSON(prompt);
                setActionResult({ type: 'anomalies', data: parsed, local: localAnoms });

            } else if (type === 'recommendations') {
                // Health-focused recommendations
                const prompt = `You are a public health advisor for environmental conditions. Generate health & safety recommendations based on our monitoring system's live data.

ENVIRONMENT SCORE (computed by our system): ${score}/100
AQI: ${sensorData.air.aqi} (${classifyAQI(sensorData.air.aqi).label})
PM2.5: ${sensorData.air.pm25} μg/m³ | PM10: ${sensorData.air.pm10} μg/m³
Temperature: ${sensorData.weather.temperature}°C | Humidity: ${sensorData.weather.humidity}%
UV Index: ${sensorData.weather.uvIndex} | Wind: ${sensorData.weather.windSpeed} km/h
Water pH: ${sensorData.water.ph} | DO: ${sensorData.water.dissolvedOxygen} mg/L
Condition: ${sensorData.weather.condition}
Active anomalies: ${localAnoms.map(a => a.message).join('; ') || 'None'}

Provide your response as JSON:
{
  "urgentActions": ["action1", "action2"],
  "healthAdvisory": {"category": "safe|caution|warning|danger", "message": "one sentence advisory"},
  "recommendations": [
    {"title": "short title", "detail": "specific actionable advice", "icon": "air|water|sun|health|indoor|outdoor", "priority": "high|medium|low"}
  ],
  "vulnerableGroups": ["group1: specific advice", "group2: specific advice"],
  "exerciseAdvice": "Should people exercise outdoors? Brief advice."
}
Return ONLY valid JSON, no markdown. Include 4-6 recommendations.`;
                const parsed = await aiRef.current.callGeminiJSON(prompt);
                setActionResult({ type: 'recommendations', data: parsed });

            } else if (type === 'report') {
                // Comprehensive report
                await refreshAIAnalysis();
                const analysis = await aiRef.current.analyzeEnvironmentalData(sensorData, hist);
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
        }
    }, [currentData, sensorsRef, aiRef, refreshAIAnalysis]);

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
                    <div className="ai-loading large"><div className="ai-loader"></div><span>Running analysis pipeline...</span></div>
                </div>
            );
        }
        if (!actionResult) return null;
        if (actionResult.error) {
            return <div className="ai-output-area"><div className="ai-error-msg">⚠ {actionResult.error}</div></div>;
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
                                <span className="ai-trend-label">🌫 Air Quality</span>
                                {renderTrendDirection(data.airTrend?.direction)}
                            </div>
                            <p>{data.airTrend?.detail}</p>
                        </div>
                        <div className="ai-trend-card">
                            <div className="ai-trend-card-top">
                                <span className="ai-trend-label">🌡 Temperature</span>
                                {renderTrendDirection(data.tempTrend?.direction)}
                            </div>
                            <p>{data.tempTrend?.detail}</p>
                        </div>
                        <div className="ai-trend-card">
                            <div className="ai-trend-card-top">
                                <span className="ai-trend-label">💧 Water Quality</span>
                                {renderTrendDirection(data.waterTrend?.direction)}
                            </div>
                            <p>{data.waterTrend?.detail}</p>
                        </div>
                    </div>
                    <div className="ai-forecast-strip">
                        <div className="ai-forecast-item">
                            <span className="forecast-label">⏱ 6-Hour Forecast</span>
                            <p>{data.forecast6h}</p>
                        </div>
                        <div className="ai-forecast-item">
                            <span className="forecast-label">📅 24-Hour Forecast</span>
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
                            <h4>🔍 Detected by Our Algorithms</h4>
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
                        <h4>🤖 AI-Predicted Anomalies (Next 6-12h)</h4>
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
                                        <span>⏱ {p.timeframe}</span>
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
            const iconMap = { air: '🌫', water: '💧', sun: '☀️', health: '❤️', indoor: '🏠', outdoor: '🌳' };
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
                            <h4>⚡ Urgent Actions</h4>
                            <ul className="urgent-list">{data.urgentActions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                        </div>
                    )}

                    <div className="ai-rec-cards">
                        {data.recommendations?.map((r, i) => (
                            <div key={i} className={`ai-rec-card priority-${r.priority}`}>
                                <div className="ai-rec-icon">{iconMap[r.icon] || '📋'}</div>
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
                            <h4>🛡 Vulnerable Groups</h4>
                            <ul className="vulnerable-list">{data.vulnerableGroups.map((g, i) => <li key={i}>{g}</li>)}</ul>
                        </div>
                    )}

                    {data.exerciseAdvice && (
                        <div className="ai-exercise-box">
                            <span>🏃 Exercise Advice:</span> {data.exerciseAdvice}
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
                    <div className="report-meta">
                        <span>Generated: {rpt.generatedAt}</span>
                        <span>Environment Score: <strong style={{ color: rpt.envScore >= 70 ? '#10b981' : rpt.envScore >= 40 ? '#f59e0b' : '#ef4444' }}>{rpt.envScore}/100</strong></span>
                        <span>AQI: <strong style={{ color: rpt.aqiCategory.color }}>{rpt.sensorData.air.aqi} ({rpt.aqiCategory.label})</strong></span>
                    </div>
                    <div className="report-section">
                        <h4>Summary</h4>
                        <p>{rpt.analysis?.summary || 'No summary available.'}</p>
                    </div>
                    {rpt.analysis?.concerns?.length > 0 && (
                        <div className="report-section concerns">
                            <h4>Current Concerns</h4>
                            <ul>{rpt.analysis.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
                        </div>
                    )}
                    {rpt.analysis?.recommendations?.length > 0 && (
                        <div className="report-section">
                            <h4>Recommendations</h4>
                            <ul>{rpt.analysis.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                        </div>
                    )}
                    {rpt.analysis?.prediction && (
                        <div className="report-section">
                            <h4>Prediction</h4>
                            <p>{rpt.analysis.prediction}</p>
                        </div>
                    )}
                    {rpt.anomalies?.length > 0 && (
                        <div className="report-section concerns">
                            <h4>Active Anomalies ({rpt.anomalies.length})</h4>
                            <ul>{rpt.anomalies.map((a, i) => <li key={i}><strong>{a.metric}:</strong> {a.message}</li>)}</ul>
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
                                disabled={actionLoading}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{action.icon}</svg>
                                <span>{action.label}</span>
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
