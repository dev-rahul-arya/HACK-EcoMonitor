import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LinearScale } from 'chart.js';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

ChartJS.register(LinearScale);

export default function WaterQualityView() {
    const { currentData, historicalData } = useApp();
    const { t } = useLanguage();

    const labels = useMemo(() =>
        historicalData.timestamps.map(t => t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })),
        [historicalData.timestamps]
    );

    const chartData = useMemo(() => ({
        labels,
        datasets: [
            { label: 'pH', data: historicalData.waterPh, borderColor: '#06b6d4', tension: 0.4, yAxisID: 'y' },
            { label: 'Dissolved O₂ (mg/L)', data: historicalData.waterPh.map(() => 6 + Math.random() * 4), borderColor: '#10b981', tension: 0.4, yAxisID: 'y1' }
        ]
    }), [labels, historicalData.waterPh]);

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#9ca3af' } } },
        scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280' } },
            y: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280' }, min: 0, max: 14 },
            y1: { type: 'linear', position: 'right', grid: { display: false }, ticks: { color: '#6b7280' } }
        }
    };

    if (!currentData) return <div className="view active"><p>{t('loading')}</p></div>;

    const metrics = [
        { label: t('phLevel'), value: currentData.water.ph, icon: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /> },
        { label: t('dissolvedOxygen'), value: currentData.water.dissolvedOxygen, unit: 'mg/L', icon: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /></> },
        { label: t('temperature'), value: currentData.water.temperature, unit: '°C', icon: <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" /> },
        { label: t('turbidity'), value: currentData.water.turbidity, unit: 'NTU', icon: <path d="M22 12h-4l-3 9L9 3l-3 9H2" /> },
        { label: t('tds'), value: currentData.water.tds, unit: 'ppm', icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01" /></> },
        { label: t('conductivity'), value: currentData.water.conductivity, unit: 'μS/cm', icon: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></> },
    ];

    return (
        <section className="view active" id="view-water-quality">
            <div className="view-content">
                <div className="detail-grid water">
                    {metrics.map(m => (
                        <div key={m.label} className="water-metric">
                            <div className="metric-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{m.icon}</svg>
                            </div>
                            <span className="metric-label">{m.label}</span>
                            <span className="metric-value">{m.value}</span>
                            {m.unit && <span className="metric-unit">{m.unit}</span>}
                        </div>
                    ))}
                </div>

                <div className="chart-card full-width">
                    <div className="card-header"><h3>{t('waterQualityTrends')}</h3></div>
                    <div className="chart-container large"><Line data={chartData} options={chartOptions} /></div>
                </div>
            </div>
        </section>
    );
}
