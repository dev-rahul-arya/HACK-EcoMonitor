import { useMemo, useState, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { useApp } from '../context/AppContext';

export default function AirQualityView() {
    const { currentData, historicalData, sensorsRef, aiRef } = useApp();
    const [recommendations, setRecommendations] = useState(null);
    const [recsLoading, setRecsLoading] = useState(false);

    const fetchRecommendations = useCallback(async () => {
        if (!currentData) return;
        setRecsLoading(true);
        try {
            const prompt = `Based on the following air quality data, provide 4-6 specific health recommendations for residents. Be concise and actionable.

Air Quality Index (AQI): ${currentData.air.aqi}
PM2.5: ${currentData.air.pm25} μg/m³
PM10: ${currentData.air.pm10} μg/m³
Ozone (O3): ${currentData.air.o3} ppb
NO2: ${currentData.air.no2} ppb
SO2: ${currentData.air.so2} ppb
CO: ${currentData.air.co} ppm

Return ONLY a JSON array of objects with "icon" (one emoji) and "text" (one sentence recommendation). Example:
[{"icon":"🏃","text":"Safe for outdoor exercise."}]`;
            const result = await aiRef.current.callGeminiAPI(prompt);
            const jsonMatch = result.match(/\[.*\]/s);
            if (jsonMatch) {
                setRecommendations(JSON.parse(jsonMatch[0]));
            } else {
                throw new Error('Could not parse recommendations');
            }
        } catch {
            // Fallback recommendations based on AQI
            const aqi = currentData.air.aqi;
            const fallback = [
                { icon: '🏃', text: aqi <= 50 ? 'Air quality is ideal for outdoor activities and exercise.' : aqi <= 100 ? 'Sensitive individuals should consider reducing prolonged outdoor exertion.' : 'Limit outdoor physical activities; exercise indoors instead.' },
                { icon: '🪟', text: aqi <= 50 ? 'Great time to open windows and ventilate your home.' : 'Keep windows closed and use air purifiers if available.' },
                { icon: '😷', text: aqi <= 100 ? 'No mask needed for most people in current conditions.' : 'Wear an N95 mask if you need to go outdoors.' },
                { icon: '👶', text: aqi <= 50 ? 'Safe conditions for children and elderly to be outdoors.' : 'Keep children and elderly indoors as much as possible.' },
                { icon: '💧', text: 'Stay well hydrated — drink at least 8 glasses of water today.' },
                { icon: '📊', text: `Current AQI is ${aqi}. ${aqi <= 50 ? 'Enjoy the clean air!' : aqi <= 100 ? 'Monitor for changes throughout the day.' : 'Check back frequently for updates.'}` },
            ];
            setRecommendations(fallback);
        } finally {
            setRecsLoading(false);
        }
    }, [currentData, aiRef]);

    const labels = useMemo(() =>
        historicalData.timestamps.map(t => t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })),
        [historicalData.timestamps]
    );

    const chartData = useMemo(() => ({
        labels,
        datasets: [{ label: 'AQI', data: historicalData.aqi, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.2)', tension: 0.4, fill: true }]
    }), [labels, historicalData.aqi]);

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#9ca3af' } } },
        scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280' } }
        }
    };

    if (!currentData) return <div className="view active"><p>Loading...</p></div>;

    const aqiStatus = sensorsRef.current.getAQIStatus(currentData.air.aqi);
    const markerPosition = Math.min((currentData.air.aqi / 300) * 100, 100);

    return (
        <section className="view active" id="view-air-quality">
            <div className="view-content">
                <div className="detail-grid">
                    <div className="detail-card highlight">
                        <div className="detail-header">
                            <span className="detail-label">Current AQI</span>
                            <span className={`detail-badge ${aqiStatus.color === 'poor' ? 'unhealthy' : aqiStatus.color}`}>{aqiStatus.status}</span>
                        </div>
                        <div className="detail-value">{currentData.air.aqi}</div>
                        <div className="aqi-scale">
                            <div className="aqi-bar"><div className="aqi-marker" style={{ left: `${markerPosition}%` }}></div></div>
                            <div className="aqi-labels"><span>Good</span><span>Moderate</span><span>Unhealthy</span><span>Hazardous</span></div>
                        </div>
                    </div>
                    <div className="pollutants-grid">
                        {[
                            { name: 'PM2.5', value: currentData.air.pm25, unit: 'μg/m³' },
                            { name: 'PM10', value: currentData.air.pm10, unit: 'μg/m³' },
                            { name: 'O₃', value: currentData.air.o3, unit: 'ppb' },
                            { name: 'NO₂', value: currentData.air.no2, unit: 'ppb' },
                            { name: 'SO₂', value: currentData.air.so2, unit: 'ppb' },
                            { name: 'CO', value: currentData.air.co, unit: 'ppm' },
                        ].map(p => (
                            <div key={p.name} className="pollutant-card">
                                <span className="pollutant-name">{p.name}</span>
                                <span className="pollutant-value">{p.value}</span>
                                <span className="pollutant-unit">{p.unit}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="chart-card full-width">
                    <div className="card-header"><h3>Air Quality History</h3></div>
                    <div className="chart-container large"><Line data={chartData} options={chartOptions} /></div>
                </div>

                <div className="recommendations-section">
                    <div className="recommendations-header">
                        <h3>Health Recommendations</h3>
                        <button
                            className="ai-recs-btn"
                            onClick={fetchRecommendations}
                            disabled={recsLoading}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}>
                                <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                                <path d="M16 14v6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6" />
                            </svg>
                            <span>{recsLoading ? 'Analyzing...' : 'Get AI Recommendations'}</span>
                        </button>
                    </div>
                    <div className="recommendations-list">
                        {recommendations ? recommendations.map((rec, i) => (
                            <div key={i} className="recommendation-item">
                                <div className="recommendation-icon ai-icon">
                                    <span style={{fontSize:'1.1rem'}}>{rec.icon}</span>
                                </div>
                                <span className="recommendation-text">{rec.text}</span>
                            </div>
                        )) : (
                            <div className="recommendation-item">
                                <div className="recommendation-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                                </div>
                                <span className="recommendation-text">{aqiStatus.recommendation}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
