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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function ClimateTrendsView() {
    const { aiRef } = useApp();
    const [rawData, setRawData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showProjections, setShowProjections] = useState(true);

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
            icon: '🔀',
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
                icon: '⚠️',
                title: `${anomalies.length} Anomalous Years Identified`,
                detail: `Σ-threshold analysis (>1.5σ) flagged ${warmCount} warm and ${coldCount} cold anomalies. Most recent: ${latestAnomaly.year} at ${latestAnomaly.temp}°C (${latestAnomaly.deviation > 0 ? '+' : ''}${latestAnomaly.deviation}σ).`,
                category: 'anomaly',
            });
        }

        // 4. Acceleration check
        const accel = risk.factors.acceleration;
        findings.push({
            icon: accel > 0.1 ? '🚀' : accel < -0.1 ? '🐢' : '➡️',
            title: accel > 0.1 ? 'Warming Acceleration Detected' : accel < -0.1 ? 'Warming Deceleration' : 'Steady Rate of Change',
            detail: `Comparing last 3 decades to first 3 decades shows a ${accel > 0 ? '+' : ''}${accel.toFixed(3)}°C shift in average temperature. ${accel > 0.2 ? 'This suggests warming is accelerating.' : 'Change is within moderate bounds.'}`,
            category: 'acceleration',
        });

        // 5. Projection summary
        if (projections.length > 0) {
            const proj25 = projections[24]; // 25 years out
            const proj50 = projections[projections.length - 1]; // 50 years out
            findings.push({
                icon: '🔮',
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
                icon: '🌊',
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

    const generatePolicyBrief = useCallback(async () => {
        if (!stats.totalRecords) return;
        setPolicyLoading(true);
        try {
            const prompt = `You are a climate policy advisor. Our climate analytics system has computed the following findings from ${stats.totalRecords} years of global temperature data (${stats.yearRange}).

=== OUR COMPUTED ANALYSIS (Algorithm Outputs) ===
Warming Rate: ${risk.factors.warmingRate}°C per century (linear regression)
Temperature Variability (σ): ${risk.factors.variability}°C  
Warming Acceleration (last vs first 3 decades): ${risk.factors.acceleration > 0 ? '+' : ''}${risk.factors.acceleration}°C
Anomalous Years Detected: ${anomalies.length} (>1.5σ threshold)
${anomalies.length > 0 ? `Warm anomalies: ${anomalies.filter(a => a.type === 'warm').length}, Cold anomalies: ${anomalies.filter(a => a.type === 'cold').length}` : ''}
Composite Risk Index: ${risk.score}/100 (${risk.level})
  - Trend component: ${risk.trendScore}/40
  - Variability component: ${risk.variabilityScore}/30
  - Acceleration component: ${risk.accelerationScore}/30
Hottest Year: ${stats.hottest.year} (${stats.hottest.temp}°C)
Coldest Year: ${stats.coldest.year} (${stats.coldest.temp}°C)
Projected temp in 50 years: ${projections.length > 0 ? projections[projections.length - 1].predicted + '°C (95% CI: ' + projections[projections.length - 1].lower + '–' + projections[projections.length - 1].upper + '°C)' : 'N/A'}
Total change (first to last decade): ${stats.totalChange}°C

Based ONLY on these computed results, generate a structured policy brief as JSON:
{
  "executiveSummary": "3-4 sentence summary for policymakers (reference specific numbers from our analysis)",
  "keyRisks": [
    {"risk": "risk title", "evidence": "reference OUR computed data point", "urgency": "immediate|short-term|long-term"}
  ],
  "policyRecommendations": [
    {"action": "specific policy action", "rationale": "why, referencing our data", "timeline": "timeframe", "impact": "high|medium|low"}
  ],
  "dataLimitations": ["limitation1", "limitation2"],
  "confidenceLevel": "high|medium|low",
  "confidenceExplanation": "brief explanation of confidence level"
}
Return ONLY valid JSON. Include 3-4 risks and 3-5 recommendations. Always reference our computed numbers.`;

            const parsed = await aiRef.current.callGeminiJSON(prompt);
            setPolicyBrief(parsed);
        } catch (err) {
            console.error('Policy brief error:', err);
            setPolicyBrief({ error: `Failed to generate policy brief: ${err.message}` });
        } finally {
            setPolicyLoading(false);
        }
    }, [stats, risk, anomalies, projections, aiRef]);

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
                                    const icons = ['❄️', '🌱', '☀️', '🍂'];
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

                {/* ===== AI POLICY BRIEF (AI-enhanced, based on our computed data) ===== */}
                <div className="climate-policy-card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                            <h3>AI-Enhanced Policy Brief</h3>
                            <span className="findings-subtitle">Gemini synthesizes our algorithmic outputs into actionable policy guidance</span>
                        </div>
                        <button className="ai-recs-btn" onClick={generatePolicyBrief} disabled={policyLoading}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                                <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                            </svg>
                            <span>{policyLoading ? 'Generating Brief...' : 'Generate Policy Brief'}</span>
                        </button>
                    </div>

                    <div className="policy-content">
                        {policyLoading ? (
                            <div className="ai-loading large"><div className="loading-spinner"></div><span>Synthesizing computed findings into policy brief...</span></div>
                        ) : policyBrief ? (
                            policyBrief.error ? (
                                <div className="ai-error-msg">⚠ {policyBrief.error}</div>
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
                                            <h4>⚠ Data Limitations</h4>
                                            <ul>
                                                {policyBrief.dataLimitations.map((l, i) => <li key={i}>{l}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            )
                        ) : (
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
                                <p>Our algorithms have already computed trend analysis, anomaly detection, and risk scoring above.</p>
                                <p className="ai-placeholder-sub">Click "Generate Policy Brief" to have AI synthesize these computed results into a structured policy document with actionable recommendations.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </section>
    );
}
