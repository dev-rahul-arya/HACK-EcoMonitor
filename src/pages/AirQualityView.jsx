import { useMemo, useState, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

/* Inline SVG icon helpers for AirQualityView */
const aqIco = (paths, size = 18) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }}>{paths}</svg>
);
const AqIcoRun = () => aqIco(<><circle cx="12" cy="5" r="2"/><path d="M4 17l4-4 2 2 4-4 2 2"/></>);
const AqIcoWindow = () => aqIco(<><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="2" y1="12" x2="22" y2="12"/></>);
const AqIcoMask = () => aqIco(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>);
const AqIcoChild = () => aqIco(<><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/></>);
const AqIcoDrop = () => aqIco(<><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></>);
const AqIcoChart = () => aqIco(<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>);

/* Map icon identifiers (from server/fallback) to SVG elements */
const icoMap = {
    run: AqIcoRun(), window: AqIcoWindow(), mask: AqIcoMask(),
    child: AqIcoChild(), water: AqIcoDrop(), chart: AqIcoChart(),
};
function resolveIcon(icon) {
    if (typeof icon !== 'string') return icon; // already JSX
    if (icoMap[icon]) return icoMap[icon];
    return <span style={{fontSize:'1.1rem'}}>{icon}</span>; // Gemini emoji fallback
}

export default function AirQualityView() {
    const { currentData, historicalData, sensorsRef, aiRef } = useApp();
    const { t } = useLanguage();
    const [recommendations, setRecommendations] = useState(null);
    const [recsLoading, setRecsLoading] = useState(false);
    const [recsCooldown, setRecsCooldown] = useState(false);

    const fetchRecommendations = useCallback(async () => {
        if (!currentData || recommendations) return; // skip if already fetched
        setRecsLoading(true);
        try {
            const result = await aiRef.current.airQualityRecommendations(currentData.air);
            setRecommendations(result.recommendations || result);
        } catch {
            // Fallback recommendations based on AQI
            const aqi = currentData.air.aqi;
            const fallback = [
                { icon: AqIcoRun(), text: aqi <= 50 ? 'Air quality is ideal for outdoor activities and exercise.' : aqi <= 100 ? 'Sensitive individuals should consider reducing prolonged outdoor exertion.' : 'Limit outdoor physical activities; exercise indoors instead.' },
                { icon: AqIcoWindow(), text: aqi <= 50 ? 'Great time to open windows and ventilate your home.' : 'Keep windows closed and use air purifiers if available.' },
                { icon: AqIcoMask(), text: aqi <= 100 ? 'No mask needed for most people in current conditions.' : 'Wear an N95 mask if you need to go outdoors.' },
                { icon: AqIcoChild(), text: aqi <= 50 ? 'Safe conditions for children and elderly to be outdoors.' : 'Keep children and elderly indoors as much as possible.' },
                { icon: AqIcoDrop(), text: 'Stay well hydrated — drink at least 8 glasses of water today.' },
                { icon: AqIcoChart(), text: `Current AQI is ${aqi}. ${aqi <= 50 ? 'Enjoy the clean air!' : aqi <= 100 ? 'Monitor for changes throughout the day.' : 'Check back frequently for updates.'}` },
            ];
            setRecommendations(fallback);
        } finally {
            setRecsLoading(false);
            setRecsCooldown(true);
            setTimeout(() => setRecsCooldown(false), 30_000);
        }
    }, [currentData, aiRef, recommendations]);

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

    if (!currentData) return <div className="view active"><p>{t('loading')}</p></div>;

    const aqiStatus = sensorsRef.current.getAQIStatus(currentData.air.aqi);
    const markerPosition = Math.min((currentData.air.aqi / 300) * 100, 100);

    return (
        <section className="view active" id="view-air-quality">
            <div className="view-content">
                <div className="detail-grid">
                    <div className="detail-card highlight">
                        <div className="detail-header">
                            <span className="detail-label">{t('currentAQI')}</span>
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
                    <div className="card-header"><h3>{t('airQualityHistory')}</h3></div>
                    <div className="chart-container large"><Line data={chartData} options={chartOptions} /></div>
                </div>

                <div className="recommendations-section">
                    <div className="recommendations-header">
                        <h3>{t('healthRecommendations')}</h3>
                        <button
                            className="ai-recs-btn"
                            onClick={fetchRecommendations}
                            disabled={recsLoading || recsCooldown || !!recommendations}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}>
                                <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                                <path d="M16 14v6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6" />
                            </svg>
                            <span>{recsLoading ? t('analyzing') : recommendations ? `${t('loadedCheck')} ✓` : t('getAIRecommendations')}</span>
                        </button>
                    </div>
                    <div className="recommendations-list">
                        {recommendations ? recommendations.map((rec, i) => (
                            <div key={i} className="recommendation-item">
                                <div className="recommendation-icon ai-icon">
                                    {resolveIcon(rec.icon)}
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
