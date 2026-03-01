import { useState, useEffect, useMemo, useCallback } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, BarElement, Title, Tooltip, Legend, Filler, ArcElement
} from 'chart.js';
import { useApp } from '../context/AppContext';
import {
    loadClimateData, computeYearlyAverages, computeDecadalAverages,
    detectAnomalies, computeRiskIndex, projectTemperatures, computeStats
} from '../modules/climateData';
import useClimateAnalysis from '../hooks/useClimateAnalysis';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

/* Inline SVG icon helpers — consistent with AIInsightsView */
const cIco = (paths, size = 16) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }}>{paths}</svg>
);
const CIcoAlert = (s = 16) => cIco(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>, s);
const CIcoCpu = (s = 16) => cIco(<><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></>, s);
const CIcoSearch = (s = 16) => cIco(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>, s);
const CIcoClock = (s = 16) => cIco(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, s);
const CIcoZap = (s = 16) => cIco(<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>, s);
const CIcoRocket = (s = 16) => cIco(<><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></>, s);
const CIcoWave = (s = 16) => cIco(<><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></>, s);
const CIcoEye = (s = 16) => cIco(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>, s);
/* Season icons */
const CIcoSnow = (s = 16) => cIco(<><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="8" y1="20" x2="8.01" y2="20"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="12" y1="22" x2="12.01" y2="22"/><line x1="16" y1="16" x2="16.01" y2="16"/><line x1="16" y1="20" x2="16.01" y2="20"/></>, s);
const CIcoSprout = (s = 16) => cIco(<><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></>, s);
const CIcoSun = (s = 16) => cIco(<><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>, s);
const CIcoLeaf = (s = 16) => cIco(<><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 1c1 2 2 4.5 2 8 0 5.5-4.78 10-10 11z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></>, s);

/** Minimal Markdown → HTML renderer (no dependencies) */
function renderMarkdown(md) {
    if (!md) return '';
    return md
        .replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
        .replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
        .replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
        .replace(/(<\/ul>\s*<ul>)/g, '')
        .replace(/\n{2,}/g, '<br/><br/>')
        .replace(/\n/g, '<br/>');
}

export default function ClimateTrendsView() {
    const { aiRef } = useApp();
    const [rawData, setRawData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showProjections, setShowProjections] = useState(true);

    // ── AI Climate Analysis (CSV → pre-computed stats → Gemini digest) ──
    const { analysis: aiClimateAnalysis, stats: aiClimateStats, meta: aiClimateMeta, loading: aiClimateLoading, error: aiClimateError, analyze: runClimateAnalysis, reset: resetClimateAnalysis } = useClimateAnalysis();
    const [startYear, setStartYear] = useState(1750);
    const [endYear, setEndYear] = useState(1900);

    useEffect(() => {
        loadClimateData()
            .then(data => { setRawData(data); setLoading(false); })
            .catch(err => { setError(err.message); setLoading(false); });
    }, []);

    const yearly = useMemo(() => rawData ? computeYearlyAverages(rawData) : [], [rawData]);
    const decadal = useMemo(() => computeDecadalAverages(yearly), [yearly]);
    const anomalies = useMemo(() => detectAnomalies(yearly), [yearly]);
    const risk = useMemo(() => computeRiskIndex(yearly, decadal), [yearly, decadal]);
    const projections = useMemo(() => projectTemperatures(yearly, 50), [yearly]);
    const stats = useMemo(() => computeStats(yearly, decadal), [yearly, decadal]);

    // --- Chart: Historical temperature trend with uncertainty ---
    const trendChartData = useMemo(() => {
        if (!yearly.length) return null;
        const labels = yearly.map(y => y.year);
        const datasets = [
            {
                label: 'Land Avg Temperature (°C)',
                data: yearly.map(y => y.landAvg),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239,68,68,0.1)',
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.3,
                fill: false,
                order: 1,
            },
            {
                label: 'Uncertainty Band (upper)',
                data: yearly.map(y => y.landAvg !== null && y.uncertainty !== null ? +(y.landAvg + y.uncertainty).toFixed(2) : null),
                borderColor: 'transparent',
                backgroundColor: 'rgba(239,68,68,0.08)',
                pointRadius: 0,
                fill: '+1',
                order: 2,
            },
            {
                label: 'Uncertainty Band (lower)',
                data: yearly.map(y => y.landAvg !== null && y.uncertainty !== null ? +(y.landAvg - y.uncertainty).toFixed(2) : null),
                borderColor: 'transparent',
                backgroundColor: 'rgba(239,68,68,0.08)',
                pointRadius: 0,
                fill: false,
                order: 3,
            },
        ];

        if (showProjections && projections.length) {
            // Extend labels
            const projLabels = projections.map(p => p.year);
            labels.push(...projLabels);
            // Pad historical datasets
            const pad = new Array(projections.length).fill(null);
            datasets[0].data.push(...pad);
            datasets[1].data.push(...pad);
            datasets[2].data.push(...pad);
            // Add projection datasets
            const projPad = new Array(yearly.length).fill(null);
            // Connect projection line to the last historical point
            const lastHistorical = yearly[yearly.length - 1]?.landAvg ?? null;
            datasets.push({
                label: 'Projected Temperature',
                data: [...projPad.slice(0, -1), lastHistorical, ...projections.map(p => p.predicted)],
                borderColor: '#f59e0b',
                borderDash: [6, 4],
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.3,
                fill: false,
                order: 0,
            });
            datasets.push({
                label: 'Projection Upper Bound',
                data: [...projPad.slice(0, -1), lastHistorical, ...projections.map(p => p.upper)],
                borderColor: 'transparent',
                backgroundColor: 'rgba(245,158,11,0.1)',
                pointRadius: 0,
                fill: '+1',
                order: 4,
            });
            datasets.push({
                label: 'Projection Lower Bound',
                data: [...projPad.slice(0, -1), lastHistorical, ...projections.map(p => p.lower)],
                borderColor: 'transparent',
                backgroundColor: 'rgba(245,158,11,0.1)',
                pointRadius: 0,
                fill: false,
                order: 5,
            });
        }

        return { labels, datasets };
    }, [yearly, projections, showProjections]);

    // --- Chart: Land vs Land+Ocean comparison ---
    const comparisonChartData = useMemo(() => {
        if (!yearly.length) return null;
        return {
            labels: yearly.map(y => y.year),
            datasets: [
                {
                    label: 'Land Average (°C)',
                    data: yearly.map(y => y.landAvg),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: true,
                },
                {
                    label: 'Land + Ocean Average (°C)',
                    data: yearly.map(y => y.landOceanAvg),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: true,
                },
            ]
        };
    }, [yearly]);

    // --- Chart: Decadal warming bars ---
    const decadalChartData = useMemo(() => {
        if (!decadal.length) return null;
        return {
            labels: decadal.map(d => d.decade),
            datasets: [{
                label: 'Avg Temperature (°C)',
                data: decadal.map(d => d.avg),
                backgroundColor: decadal.map(d =>
                    d.anomaly > 1 ? 'rgba(239,68,68,0.7)' :
                    d.anomaly > 0.5 ? 'rgba(245,158,11,0.7)' :
                    d.anomaly > 0 ? 'rgba(59,130,246,0.7)' :
                    'rgba(16,185,129,0.7)'
                ),
                borderRadius: 4,
            }]
        };
    }, [decadal]);

    const chartOptions = (titleText) => ({
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#9ca3af', font: { size: 11 } }, position: 'top' },
            title: { display: !!titleText, text: titleText, color: '#e5e7eb', font: { size: 14 } },
            tooltip: { mode: 'index', intersect: false },
        },
        scales: {
            x: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#6b7280', maxTicksLimit: 20, font: { size: 10 } },
            },
            y: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#6b7280' },
            }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
    });

    const barOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `${ctx.parsed.y.toFixed(2)}°C` } },
        },
        scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280', font: { size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280' } },
        },
    };

    // --- Computed Insights (100% local, no AI) ---
    const computedFindings = useMemo(() => {
        if (!yearly.length || !decadal.length) return [];
        const findings = [];

        // 1. Overall trend direction
        const firstDecade = decadal[0];
        const lastDecade = decadal[decadal.length - 1];
        const change = lastDecade.avg - firstDecade.avg;
        findings.push({
            icon: change > 0 ? '📈' : '📉',
            title: `${change > 0 ? 'Warming' : 'Cooling'} Trend Detected`,
            detail: `Linear regression analysis shows a ${change > 0 ? '+' : ''}${change.toFixed(3)}°C shift from the ${firstDecade.decade} to the ${lastDecade.decade}. The warming rate is ${Math.abs(risk.factors.warmingRate).toFixed(4)}°C per century.`,
            category: 'trend',
        });

        // 2. Variability analysis
        const avgVariability = decadal.reduce((s, d) => s + d.range, 0) / decadal.length;
        const recentVariability = decadal.slice(-3).reduce((s, d) => s + d.range, 0) / Math.min(3, decadal.length);
        const varChange = recentVariability - avgVariability;
        findings.push({
            icon: CIcoZap(),
            title: 'Temperature Variability',
            detail: `Standard deviation: σ = ${risk.factors.variability}°C across ${stats.totalRecords} yearly records. Recent decades show ${varChange > 0.1 ? 'increasing' : varChange < -0.1 ? 'decreasing' : 'stable'} year-to-year variability (avg range: ${recentVariability.toFixed(2)}°C vs historical ${avgVariability.toFixed(2)}°C).`,
            category: 'variability',
        });

        // 3. Anomaly pattern
        if (anomalies.length > 0) {
            const warmCount = anomalies.filter(a => a.type === 'warm').length;
            const coldCount = anomalies.filter(a => a.type === 'cold').length;
            const latestAnomaly = anomalies[anomalies.length - 1];
            findings.push({
                icon: CIcoAlert(),
                title: `${anomalies.length} Anomalous Years Identified`,
                detail: `Σ-threshold analysis (>1.5σ) flagged ${warmCount} warm and ${coldCount} cold anomalies. Most recent: ${latestAnomaly.year} at ${latestAnomaly.temp}°C (${latestAnomaly.deviation > 0 ? '+' : ''}${latestAnomaly.deviation}σ).`,
                category: 'anomaly',
            });
        }

        // 4. Acceleration check
        const accel = risk.factors.acceleration;
        findings.push({
            icon: accel > 0.1 ? CIcoRocket() : accel < -0.1 ? CIcoClock() : CIcoZap(),
            title: accel > 0.1 ? 'Warming Acceleration Detected' : accel < -0.1 ? 'Warming Deceleration' : 'Steady Rate of Change',
            detail: `Comparing last 3 decades to first 3 decades shows a ${accel > 0 ? '+' : ''}${accel.toFixed(3)}°C shift in average temperature. ${accel > 0.2 ? 'This suggests warming is accelerating.' : 'Change is within moderate bounds.'}`,
            category: 'acceleration',
        });

        // 5. Projection summary
        if (projections.length > 0) {
            const proj25 = projections[24]; // 25 years out
            const proj50 = projections[projections.length - 1]; // 50 years out
            findings.push({
                icon: CIcoEye(),
                title: 'Forward Projections (Linear Model)',
                detail: `Extrapolating current trends: ${proj25.year} → ${proj25.predicted}°C (±${(proj25.upper - proj25.predicted).toFixed(2)}°C at 95% CI). ${proj50.year} → ${proj50.predicted}°C (±${(proj50.upper - proj50.predicted).toFixed(2)}°C). Uncertainty grows with projection distance.`,
                category: 'projection',
            });
        }

        // 6. Land vs Ocean gap
        const landOceanYears = yearly.filter(y => y.landOceanAvg !== null && y.landAvg !== null);
        if (landOceanYears.length > 10) {
            const gaps = landOceanYears.map(y => y.landAvg - y.landOceanAvg);
            const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            findings.push({
                icon: CIcoWave(),
                title: 'Land-Ocean Temperature Differential',
                detail: `Land temperatures average ${avgGap > 0 ? '+' : ''}${avgGap.toFixed(2)}°C relative to combined land+ocean. ${avgGap > 0 ? 'Land warms faster than oceans, consistent with lower ocean thermal inertia effect on land masses.' : 'Temperature gap is within expected range.'}`,
                category: 'comparison',
            });
        }

        return findings;
    }, [yearly, decadal, anomalies, risk, stats, projections]);

    // --- Seasonal Pattern Analysis ---
    const seasonalData = useMemo(() => {
        if (!rawData || rawData.length === 0) return null;
        const seasons = {
            'Winter (DJF)': { sum: 0, count: 0 },
            'Spring (MAM)': { sum: 0, count: 0 },
            'Summer (JJA)': { sum: 0, count: 0 },
            'Autumn (SON)': { sum: 0, count: 0 },
        };
        for (const r of rawData) {
            if (r.landAvg === null) continue;
            const m = r.month;
            if (m === 12 || m === 1 || m === 2) { seasons['Winter (DJF)'].sum += r.landAvg; seasons['Winter (DJF)'].count++; }
            else if (m >= 3 && m <= 5) { seasons['Spring (MAM)'].sum += r.landAvg; seasons['Spring (MAM)'].count++; }
            else if (m >= 6 && m <= 8) { seasons['Summer (JJA)'].sum += r.landAvg; seasons['Summer (JJA)'].count++; }
            else { seasons['Autumn (SON)'].sum += r.landAvg; seasons['Autumn (SON)'].count++; }
        }
        return Object.entries(seasons).map(([name, s]) => ({
            name,
            avg: s.count ? +(s.sum / s.count).toFixed(2) : 0,
        }));
    }, [rawData]);

    const seasonalChartData = useMemo(() => {
        if (!seasonalData) return null;
        return {
            labels: seasonalData.map(s => s.name),
            datasets: [{
                data: seasonalData.map(s => s.avg),
                backgroundColor: ['#3b82f6', '#10b981', '#ef4444', '#f59e0b'],
                borderWidth: 0,
            }],
        };
    }, [seasonalData]);

    // --- AI Policy Brief (structured, not chatbot) ---
    const [policyBrief, setPolicyBrief] = useState(null);
    const [policyLoading, setPolicyLoading] = useState(false);
    const [policyCooldown, setPolicyCooldown] = useState(false);

    const generatePolicyBrief = useCallback(async () => {
        if (!stats.totalRecords || policyBrief) return; // skip if already generated (static data)
        setPolicyLoading(true);
        try {
            // Backend does pandas processing + compact Gemini call
            const parsed = await aiRef.current.climatePolicyBrief();
            setPolicyBrief(parsed);
        } catch (err) {
            console.error('Policy brief error:', err);
            setPolicyBrief({ error: `Failed to generate policy brief: ${err.message}` });
        } finally {
            setPolicyLoading(false);
            setPolicyCooldown(true);
            setTimeout(() => setPolicyCooldown(false), 60_000); // 60s cooldown
        }
    }, [stats, aiRef, policyBrief]);

    if (loading) {
        return (
            <section className="view active">
                <div className="climate-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading climate data...</p>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="view active">
                <div className="climate-error">
                    <p>Failed to load climate data: {error}</p>
                </div>
            </section>
        );
    }

    return (
        <section className="view active" id="view-climate-trends">
            <div className="view-content">

                {/* Stats Cards Row */}
                <div className="climate-stats-grid">
                    <div className="climate-stat-card">
                        <span className="climate-stat-label">Data Range</span>
                        <span className="climate-stat-value">{stats.yearRange}</span>
                        <span className="climate-stat-sub">{stats.totalRecords} yearly records</span>
                    </div>
                    <div className="climate-stat-card">
                        <span className="climate-stat-label">Hottest Year</span>
                        <span className="climate-stat-value" style={{ color: '#ef4444' }}>{stats.hottest?.temp}°C</span>
                        <span className="climate-stat-sub">{stats.hottest?.year}</span>
                    </div>
                    <div className="climate-stat-card">
                        <span className="climate-stat-label">Coldest Year</span>
                        <span className="climate-stat-value" style={{ color: '#3b82f6' }}>{stats.coldest?.temp}°C</span>
                        <span className="climate-stat-sub">{stats.coldest?.year}</span>
                    </div>
                    <div className="climate-stat-card">
                        <span className="climate-stat-label">Total Change</span>
                        <span className="climate-stat-value" style={{ color: stats.totalChange > 0 ? '#ef4444' : '#10b981' }}>
                            {stats.totalChange > 0 ? '+' : ''}{stats.totalChange}°C
                        </span>
                        <span className="climate-stat-sub">First to last decade</span>
                    </div>
                </div>

                {/* AI Climate Analysis card removed — merged into Policy Brief below */}

                {/* Risk Index Card */}
                <div className="climate-risk-card">
                    <div className="risk-header">
                        <h3>Climate Risk Index</h3>
                        <span className="risk-badge" style={{ background: risk.color }}>{risk.level}</span>
                    </div>
                    <div className="risk-body">
                        <div className="risk-score-ring">
                            <svg viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                                <circle cx="60" cy="60" r="52" fill="none" stroke={risk.color} strokeWidth="8"
                                    strokeDasharray={`${(risk.score / 100) * 327} 327`}
                                    strokeLinecap="round" transform="rotate(-90 60 60)" />
                            </svg>
                            <div className="risk-score-text">
                                <span className="risk-number">{risk.score}</span>
                                <span className="risk-of">/100</span>
                            </div>
                        </div>
                        <div className="risk-factors">
                            <div className="risk-factor">
                                <div className="factor-bar-track"><div className="factor-bar-fill" style={{ width: `${(risk.trendScore / 40) * 100}%`, background: '#ef4444' }}></div></div>
                                <div className="factor-info">
                                    <span className="factor-name">Warming Rate</span>
                                    <span className="factor-value">{risk.factors.warmingRate}°C/century</span>
                                </div>
                            </div>
                            <div className="risk-factor">
                                <div className="factor-bar-track"><div className="factor-bar-fill" style={{ width: `${(risk.variabilityScore / 30) * 100}%`, background: '#f59e0b' }}></div></div>
                                <div className="factor-info">
                                    <span className="factor-name">Variability</span>
                                    <span className="factor-value">σ = {risk.factors.variability}°C</span>
                                </div>
                            </div>
                            <div className="risk-factor">
                                <div className="factor-bar-track"><div className="factor-bar-fill" style={{ width: `${(risk.accelerationScore / 30) * 100}%`, background: '#3b82f6' }}></div></div>
                                <div className="factor-info">
                                    <span className="factor-name">Acceleration</span>
                                    <span className="factor-value">{risk.factors.acceleration > 0 ? '+' : ''}{risk.factors.acceleration}°C</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Historical Temperature Trend Chart */}
                <div className="chart-card full-width">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3>Global Temperature Trend ({stats.yearRange})</h3>
                        <label className="toggle-label">
                            <input type="checkbox" checked={showProjections} onChange={e => setShowProjections(e.target.checked)} />
                            <span>Show 50-Year Projections</span>
                        </label>
                    </div>
                    <div className="chart-container large">
                        {trendChartData && <Line data={trendChartData} options={chartOptions()} />}
                    </div>
                </div>

                {/* Two-column: Decadal + Comparison */}
                <div className="climate-charts-row">
                    <div className="chart-card">
                        <div className="card-header"><h3>Decadal Warming Analysis</h3></div>
                        <div className="chart-container medium">
                            {decadalChartData && <Bar data={decadalChartData} options={barOptions} />}
                        </div>
                    </div>
                    <div className="chart-card">
                        <div className="card-header"><h3>Land vs Land + Ocean</h3></div>
                        <div className="chart-container medium">
                            {comparisonChartData && <Line data={comparisonChartData} options={chartOptions()} />}
                        </div>
                    </div>
                </div>

                {/* Anomalies Table */}
                {anomalies.length > 0 && (
                    <div className="climate-anomalies-card">
                        <div className="card-header">
                            <h3>Temperature Anomalies</h3>
                            <span className="anomaly-count">{anomalies.length} anomalous years detected</span>
                        </div>
                        <div className="anomalies-scroll">
                            <table className="anomalies-table">
                                <thead>
                                    <tr><th>Year</th><th>Temperature</th><th>Deviation</th><th>Type</th></tr>
                                </thead>
                                <tbody>
                                    {anomalies.map(a => (
                                        <tr key={a.year}>
                                            <td>{a.year}</td>
                                            <td>{a.temp}°C</td>
                                            <td>{a.deviation > 0 ? '+' : ''}{a.deviation}σ</td>
                                            <td><span className={`anomaly-type ${a.type}`}>{a.type === 'warm' ? '🔴 Warm' : '🔵 Cold'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Seasonal Analysis + mini chart */}
                {seasonalData && (
                    <div className="climate-charts-row">
                        <div className="chart-card">
                            <div className="card-header"><h3>Seasonal Temperature Distribution</h3></div>
                            <div className="chart-container medium" style={{ display: 'flex', justifyContent: 'center' }}>
                                {seasonalChartData && (
                                    <Doughnut data={seasonalChartData} options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 11 }, padding: 12 } },
                                            tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}°C avg` } },
                                        },
                                    }} />
                                )}
                            </div>
                        </div>
                        <div className="chart-card">
                            <div className="card-header"><h3>Seasonal Averages</h3></div>
                            <div className="seasonal-stats">
                                {seasonalData.map((s, i) => {
                                    const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b'];
                                    const icons = [CIcoSnow(18), CIcoSprout(18), CIcoSun(18), CIcoLeaf(18)];
                                    return (
                                        <div key={i} className="seasonal-stat-item">
                                            <span className="seasonal-icon">{icons[i]}</span>
                                            <div className="seasonal-info">
                                                <span className="seasonal-name">{s.name}</span>
                                                <span className="seasonal-temp" style={{ color: colors[i] }}>{s.avg}°C</span>
                                            </div>
                                            <div className="seasonal-bar-bg">
                                                <div className="seasonal-bar-fill" style={{
                                                    width: `${Math.max(((s.avg - Math.min(...seasonalData.map(x => x.avg))) / (Math.max(...seasonalData.map(x => x.avg)) - Math.min(...seasonalData.map(x => x.avg)) || 1)) * 100, 5)}%`,
                                                    background: colors[i]
                                                }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== COMPUTED FINDINGS (LOCAL - No AI) ===== */}
                <div className="climate-findings-card">
                    <div className="card-header">
                        <div>
                            <h3>Algorithmic Findings</h3>
                            <span className="findings-subtitle">Auto-generated by our trend detection, anomaly analysis, and projection algorithms — no AI involved</span>
                        </div>
                        <span className="algo-badge">LOCAL COMPUTE</span>
                    </div>
                    <div className="findings-grid">
                        {computedFindings.map((f, i) => (
                            <div key={i} className={`finding-card category-${f.category}`}>
                                <div className="finding-icon">{f.icon}</div>
                                <div className="finding-body">
                                    <h4>{f.title}</h4>
                                    <p>{f.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ===== MERGED: AI Climate Analysis + Policy Brief ===== */}
                <div className="climate-policy-card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                            <h3>AI-Enhanced Policy Brief</h3>
                            <span className="findings-subtitle">Compute stats → AI climate analysis → synthesize into actionable policy guidance</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <label style={{ fontSize: '0.8rem', color: '#9ca3af' }}>From
                                <input type="number" min={1750} max={2025} value={startYear}
                                    onChange={e => setStartYear(+e.target.value)}
                                    style={{ width: 72, marginLeft: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', fontSize: '0.85rem' }} />
                            </label>
                            <label style={{ fontSize: '0.8rem', color: '#9ca3af' }}>To
                                <input type="number" min={1750} max={2025} value={endYear}
                                    onChange={e => setEndYear(+e.target.value)}
                                    style={{ width: 72, marginLeft: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', fontSize: '0.85rem' }} />
                            </label>
                            <button
                                onClick={() => runClimateAnalysis(startYear, endYear)}
                                disabled={aiClimateLoading}
                                style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: aiClimateLoading ? '#374151' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', cursor: aiClimateLoading ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                {aiClimateLoading ? <>{CIcoClock(14)} Analyzing...</> : <>{CIcoSearch(14)} Analyze</>}
                            </button>
                            {aiClimateAnalysis && (
                                <button onClick={resetClimateAnalysis}
                                    style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem' }}>
                                    Clear
                                </button>
                            )}
                            <button className="ai-recs-btn" onClick={generatePolicyBrief} disabled={policyLoading || policyCooldown || !!policyBrief}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                                    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                                </svg>
                                <span>{policyLoading ? 'Generating Brief...' : policyBrief ? 'Brief Generated ✓' : 'Generate Policy Brief'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="policy-content">
                        {/* ── Climate Analysis Section ── */}
                        {aiClimateError && (
                            <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                {CIcoAlert(14)} {aiClimateError}
                            </div>
                        )}

                        {aiClimateLoading && (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                <div className="loading-spinner" style={{ margin: '0 auto 0.75rem' }}></div>
                                <p>Computing stats for {startYear}–{endYear}, then generating AI narrative...</p>
                            </div>
                        )}

                        {aiClimateStats && (
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                    {[
                                        { label: 'Period', value: aiClimateStats.stats?.yearRange, color: '#93c5fd' },
                                        { label: 'Records', value: `${aiClimateStats.stats?.monthlyRecords} mo / ${aiClimateStats.stats?.totalRecords} yr`, color: '#93c5fd' },
                                        { label: 'Mean', value: `${aiClimateStats.stats?.overallMean}°C`, color: '#fde68a' },
                                        { label: 'Trend', value: `${aiClimateStats.trend?.slopePerDecade > 0 ? '+' : ''}${aiClimateStats.trend?.slopePerDecade}°C/decade`, color: aiClimateStats.trend?.slopePerDecade > 0 ? '#fca5a5' : '#86efac' },
                                        { label: 'R²', value: aiClimateStats.trend?.rSquared, color: '#c4b5fd' },
                                        { label: 'Hottest', value: `${aiClimateStats.stats?.hottest?.year} (${aiClimateStats.stats?.hottest?.temp}°C)`, color: '#fca5a5' },
                                        { label: 'Coldest', value: `${aiClimateStats.stats?.coldest?.year} (${aiClimateStats.stats?.coldest?.temp}°C)`, color: '#7dd3fc' },
                                        { label: 'Change', value: `${aiClimateStats.stats?.totalChange > 0 ? '+' : ''}${aiClimateStats.stats?.totalChange}°C`, color: '#fde68a' },
                                        { label: 'Risk', value: `${aiClimateStats.risk?.score}/100 (${aiClimateStats.risk?.level})`, color: aiClimateStats.risk?.color || '#9ca3af' },
                                        { label: 'Anomalies', value: `${aiClimateStats.anomalySummary?.total} (${aiClimateStats.anomalySummary?.warm} warm / ${aiClimateStats.anomalySummary?.cold} cold)`, color: '#fbbf24' },
                                    ].filter(c => c.value != null).map((chip, i) => (
                                        <div key={i} style={{ padding: '0.35rem 0.65rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: '0.78rem' }}>
                                            <span style={{ color: '#6b7280' }}>{chip.label}: </span>
                                            <span style={{ color: chip.color, fontWeight: 600 }}>{chip.value}</span>
                                        </div>
                                    ))}
                                </div>
                                {aiClimateMeta?.tokenStrategy && (
                                    <div style={{ fontSize: '0.72rem', color: '#4b5563', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <span>{CIcoZap(12)} Strategy: {aiClimateMeta.tokenStrategy}</span>
                                        <span>•</span>
                                        <span>Source: {aiClimateMeta.source}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {aiClimateAnalysis && (
                            <div style={{ marginBottom: '1.25rem' }}>
                                <h4 style={{ margin: '0 0 0.5rem', color: '#e5e7eb', fontSize: '0.95rem' }}>{CIcoCpu(16)} AI Climate Analysis</h4>
                                <div className="ai-markdown-output"
                                    style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: 10, lineHeight: 1.7, color: '#d1d5db', fontSize: '0.9rem', maxHeight: 600, overflowY: 'auto' }}
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(aiClimateAnalysis) }} />
                            </div>
                        )}

                        {/* ── Divider between analysis & policy brief ── */}
                        {(aiClimateAnalysis || aiClimateStats) && (policyBrief || policyLoading) && (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0.75rem 0 1rem' }}></div>
                        )}

                        {/* ── Policy Brief Section ── */}
                        {policyLoading ? (
                            <div className="ai-loading large"><div className="loading-spinner"></div><span>Synthesizing computed findings into policy brief...</span></div>
                        ) : policyBrief ? (
                            policyBrief.error ? (
                                <div className="ai-error-msg">{CIcoAlert(14)} {policyBrief.error}</div>
                            ) : (
                                <>
                                    {/* Pipeline indicator */}
                                    <div className="pipeline-indicator">
                                        <div className="pipeline-step completed">
                                            <span className="step-dot"></span>
                                            <span>Data Parsed</span>
                                        </div>
                                        <div className="pipeline-arrow">→</div>
                                        <div className="pipeline-step completed">
                                            <span className="step-dot"></span>
                                            <span>Trends Computed</span>
                                        </div>
                                        <div className="pipeline-arrow">→</div>
                                        <div className="pipeline-step completed">
                                            <span className="step-dot"></span>
                                            <span>Anomalies Detected</span>
                                        </div>
                                        <div className="pipeline-arrow">→</div>
                                        <div className="pipeline-step completed">
                                            <span className="step-dot"></span>
                                            <span>Risk Scored</span>
                                        </div>
                                        <div className="pipeline-arrow">→</div>
                                        <div className="pipeline-step active">
                                            <span className="step-dot"></span>
                                            <span>AI Synthesis</span>
                                        </div>
                                    </div>

                                    {/* Executive Summary */}
                                    <div className="policy-exec-summary">
                                        <h4>Executive Summary</h4>
                                        <p>{policyBrief.executiveSummary}</p>
                                        <div className="confidence-indicator">
                                            <span>Analysis Confidence:</span>
                                            <span className={`confidence-level ${policyBrief.confidenceLevel}`}>{policyBrief.confidenceLevel}</span>
                                            {policyBrief.confidenceExplanation && <p className="confidence-explain">{policyBrief.confidenceExplanation}</p>}
                                        </div>
                                    </div>

                                    {/* Key Risks */}
                                    {policyBrief.keyRisks?.length > 0 && (
                                        <div className="policy-section">
                                            <h4>Key Risks</h4>
                                            <div className="policy-risks-list">
                                                {policyBrief.keyRisks.map((r, i) => (
                                                    <div key={i} className={`policy-risk-item urgency-${r.urgency}`}>
                                                        <div className="policy-risk-top">
                                                            <span className="policy-risk-name">{r.risk}</span>
                                                            <span className={`urgency-tag ${r.urgency}`}>{r.urgency}</span>
                                                        </div>
                                                        <p className="policy-risk-evidence">{r.evidence}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Policy Recommendations */}
                                    {policyBrief.policyRecommendations?.length > 0 && (
                                        <div className="policy-section">
                                            <h4>Policy Recommendations</h4>
                                            <div className="policy-recs-list">
                                                {policyBrief.policyRecommendations.map((r, i) => (
                                                    <div key={i} className={`policy-rec-item impact-${r.impact}`}>
                                                        <div className="policy-rec-header">
                                                            <span className="policy-rec-number">{i + 1}</span>
                                                            <div>
                                                                <strong>{r.action}</strong>
                                                                <span className="policy-rec-timeline">⏱ {r.timeline}</span>
                                                            </div>
                                                            <span className={`impact-tag ${r.impact}`}>{r.impact} impact</span>
                                                        </div>
                                                        <p>{r.rationale}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Data Limitations */}
                                    {policyBrief.dataLimitations?.length > 0 && (
                                        <div className="policy-limitations">
                                            <h4>{CIcoAlert()} Data Limitations</h4>
                                            <ul>
                                                {policyBrief.dataLimitations.map((l, i) => <li key={i}>{l}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            )
                        ) : !aiClimateAnalysis && !aiClimateLoading && !aiClimateError ? (
                            <div className="ai-placeholder">
                                <div className="pipeline-indicator faded">
                                    <div className="pipeline-step completed">
                                        <span className="step-dot"></span>
                                        <span>Data Parsed</span>
                                    </div>
                                    <div className="pipeline-arrow">→</div>
                                    <div className="pipeline-step completed">
                                        <span className="step-dot"></span>
                                        <span>Trends Computed</span>
                                    </div>
                                    <div className="pipeline-arrow">→</div>
                                    <div className="pipeline-step completed">
                                        <span className="step-dot"></span>
                                        <span>Anomalies Detected</span>
                                    </div>
                                    <div className="pipeline-arrow">→</div>
                                    <div className="pipeline-step completed">
                                        <span className="step-dot"></span>
                                        <span>Risk Scored</span>
                                    </div>
                                    <div className="pipeline-arrow">→</div>
                                    <div className="pipeline-step pending">
                                        <span className="step-dot"></span>
                                        <span>AI Synthesis</span>
                                    </div>
                                </div>
                                <p>Select a year range and click <strong>Analyze</strong> to compute statistics and get AI-powered insights, then <strong>Generate Policy Brief</strong> to synthesize results into a structured policy document.</p>
                            </div>
                        ) : null}
                    </div>
                </div>

            </div>
        </section>
    );
}
