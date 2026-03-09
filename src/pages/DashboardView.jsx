import { useMemo } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

function StatCard({ label, value, unit, trend, indicatorColor }) {
    const icon = trend?.direction === 'up' ? '↑' : trend?.direction === 'down' ? '↓' : '→';
    return (
        <div className="stat-card">
            <div className="stat-content">
                <span className="stat-label">{label}</span>
                <div className="stat-value-row">
                    <span className="stat-value">{value}</span>
                    <span className="stat-unit">{unit}</span>
                </div>
                <div className={`stat-trend ${trend?.direction || 'stable'}`}>
                    <span className="trend-icon">{icon}</span>
                    <span className="trend-text">{trend?.change > 0 ? `${trend.change}% from avg` : 'Stable'}</span>
                </div>
            </div>
            <div className={`stat-indicator ${indicatorColor}`}></div>
        </div>
    );
}

export default function DashboardView() {
    const {
        currentData, historicalData, aiAnalysis, aiLoading, refreshAIAnalysis,
        alertHistory, sensorList, sensorsRef, exportReport, exportReportCSV
    } = useApp();
    const { t } = useLanguage();

    const labels = useMemo(() =>
        historicalData.timestamps.map(t => t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })),
        [historicalData.timestamps]
    );

    const trendsData = useMemo(() => ({
        labels,
        datasets: [
            { label: 'AQI', data: historicalData.aqi, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4, fill: true },
            { label: 'Temperature (°C)', data: historicalData.temperature, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.4, fill: true },
            { label: 'Humidity (%)', data: historicalData.humidity, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true },
        ]
    }), [labels, historicalData]);

    const pollutantsData = useMemo(() => {
        if (!currentData) return null;
        return {
            labels: ['PM2.5', 'PM10', 'O₃', 'NO₂', 'SO₂', 'CO'],
            datasets: [{ data: [parseFloat(currentData.air.pm25), parseFloat(currentData.air.pm10), parseFloat(currentData.air.o3), parseFloat(currentData.air.no2), parseFloat(currentData.air.so2), parseFloat(currentData.air.co) * 10], backgroundColor: ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981'], borderWidth: 0 }]
        };
    }, [currentData]);

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#9ca3af', font: { family: 'Inter' } } } },
        scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280' } }
        },
        interaction: { intersect: false, mode: 'index' }
    };

    const doughnutOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 11 } } } }
    };

    if (!currentData) return <div className="view active"><p>{t('loadingData')}</p></div>;

    const aqiStatus = sensorsRef.current.getAQIStatus(currentData.air.aqi);
    const hist = historicalData;

    const getIndicatorColor = (type) => {
        if (type === 'aqi') return aqiStatus.color;
        if (type === 'temp') {
            const t = parseFloat(currentData.weather.temperature);
            if (t < 15 || t > 32) return 'poor';
            if (t < 18 || t > 26) return 'moderate';
            return 'good';
        }
        if (type === 'humidity') {
            const h = parseFloat(currentData.weather.humidity);
            if (h < 30 || h > 70) return 'poor';
            if (h < 40 || h > 60) return 'moderate';
            return 'good';
        }
        return 'good';
    };

    const recentAlerts = alertHistory.slice(0, 5);
    const onlineSensors = sensorList.filter(s => s.status === 'online').length;

    return (
        <section className="view active" id="view-dashboard">
            <div className="stats-grid">
                <StatCard label={t('airQualityIndex')} value={currentData.air.aqi} unit="AQI" trend={sensorsRef.current.calculateTrend(hist.aqi)} indicatorColor={getIndicatorColor('aqi')} />
                <StatCard label={t('temperature')} value={Math.round(currentData.weather.temperature)} unit="°C" trend={sensorsRef.current.calculateTrend(hist.temperature)} indicatorColor={getIndicatorColor('temp')} />
                <StatCard label={t('humidity')} value={Math.round(currentData.weather.humidity)} unit="%" trend={sensorsRef.current.calculateTrend(hist.humidity)} indicatorColor={getIndicatorColor('humidity')} />
                <StatCard label={t('waterPhLevel')} value={parseFloat(currentData.water.ph).toFixed(1)} unit="pH" trend={sensorsRef.current.calculateTrend(hist.waterPh)} indicatorColor="good" />
            </div>

            <div className="charts-grid">
                <div className="chart-card large">
                    <div className="card-header"><h3>{t('environmentalTrends')}</h3></div>
                    <div className="chart-container"><Line data={trendsData} options={chartOptions} /></div>
                </div>
                <div className="chart-card">
                    <div className="card-header"><h3>{t('pollutantDistribution')}</h3></div>
                    <div className="chart-container">{pollutantsData && <Doughnut data={pollutantsData} options={doughnutOptions} />}</div>
                </div>
            </div>

            <div className="content-grid">
                <div className="panel ai-panel">
                    <div className="panel-header">
                        <div className="panel-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            <h3>{t('aiAnalysis')}</h3>
                        </div>
                        <button className={`panel-action ${aiLoading ? 'spinning' : ''}`} onClick={refreshAIAnalysis} disabled={aiLoading} title="Refresh Analysis">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                        </button>
                    </div>
                    <div className="ai-content">
                        {aiLoading ? (
                            <div className="ai-loading"><div className="ai-loader"></div><span>{t('analyzingData')}</span></div>
                        ) : aiAnalysis ? (
                            <>
                                {aiAnalysis.summary && <div className="ai-insight"><div className="ai-insight-title">{t('summary')}</div><div className="ai-insight-text">{aiAnalysis.summary}</div></div>}
                                {aiAnalysis.concerns?.length > 0 && <div className={`ai-insight ${aiAnalysis.concerns.length > 2 ? 'critical' : 'warning'}`}><div className="ai-insight-title">{t('concerns')}</div><div className="ai-insight-text">{aiAnalysis.concerns.join('. ')}</div></div>}
                                {aiAnalysis.recommendations?.length > 0 && <div className="ai-insight"><div className="ai-insight-title">{t('recommendations')}</div><div className="ai-insight-text">{aiAnalysis.recommendations[0]}</div></div>}
                            </>
                        ) : <p className="ai-insight-text">{t('noConcerns')}</p>}
                    </div>
                </div>

                <div className="panel alerts-panel">
                    <div className="panel-header">
                        <div className="panel-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            <h3>{t('recentAlerts')}</h3>
                        </div>
                    </div>
                    <div className="alerts-list">
                        {recentAlerts.length === 0 ? (
                            <div className="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg><p>{t('noActiveAlerts')}</p></div>
                        ) : recentAlerts.map(alert => (
                            <div key={alert.id} className="alert-item">
                                <div className={`alert-icon ${alert.severity}`}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                </div>
                                <div className="alert-content">
                                    <div className="alert-title">{alert.type === 'air' ? 'Air Quality Alert' : alert.type === 'water' ? 'Water Quality Alert' : 'Weather Alert'}</div>
                                    <div className="alert-message">{alert.message}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="panel sensors-panel">
                    <div className="panel-header">
                        <div className="panel-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="2" /><circle cx="15" cy="9" r="2" /><circle cx="9" cy="15" r="2" /><circle cx="15" cy="15" r="2" /></svg>
                            <h3>{t('sensorNetwork')}</h3>
                        </div>
                        <span className="sensor-count">{onlineSensors} / {sensorList.length} {t('online')}</span>
                    </div>
                    <div className="sensors-grid">
                        {sensorList.map(sensor => (
                            <div key={sensor.id} className="sensor-item">
                                <div className="sensor-header">
                                    <span className="sensor-name">{sensor.id}</span>
                                    <span className={`sensor-status ${sensor.status}`}></span>
                                </div>
                                <span className="sensor-type">{sensor.type}</span>
                                <span className="sensor-value">{sensor.lastReading || '--'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="quick-actions">
                <button className="quick-action-btn" onClick={exportReport}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                    <span>{t('exportReport')} (JSON)</span>
                </button>
                <button className="quick-action-btn" onClick={exportReportCSV}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    <span>{t('exportReport')} (CSV)</span>
                </button>
            </div>
        </section>
    );
}
