import { useApp } from '../context/AppContext';

export default function AIInsightsView() {
    const { aiAnalysis, aiLoading, refreshAIAnalysis, exportReport, showToast } = useApp();

    return (
        <section className="view active" id="view-ai-insights">
            <div className="view-content">
                <div className="ai-dashboard">
                    <div className="ai-summary-card">
                        <div className="ai-header">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                                <path d="M16 14v6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6" />
                            </svg>
                            <h2>Environmental Intelligence Report</h2>
                        </div>
                        <div className="ai-timestamp">Last analyzed: {aiAnalysis ? new Date().toLocaleTimeString() : '--'}</div>
                        <div className="ai-report">
                            {aiLoading ? (
                                <div className="ai-loading large"><div className="ai-loader"></div><span>Generating comprehensive analysis...</span></div>
                            ) : aiAnalysis ? (
                                <div className="ai-report-content">
                                    <h4>Environmental Summary</h4>
                                    <p>{aiAnalysis.summary || 'No summary available.'}</p>
                                    {aiAnalysis.concerns?.length > 0 && (
                                        <><h4>Current Concerns</h4><ul>{aiAnalysis.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul></>
                                    )}
                                    {aiAnalysis.recommendations?.length > 0 && (
                                        <><h4>Recommendations</h4><ul>{aiAnalysis.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul></>
                                    )}
                                    {aiAnalysis.prediction && <><h4>Prediction</h4><p>{aiAnalysis.prediction}</p></>}
                                </div>
                            ) : <p>No analysis available yet.</p>}
                        </div>
                    </div>

                    <div className="ai-actions-grid">
                        <button className="ai-action-card" onClick={refreshAIAnalysis}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                            <span>Analyze Trends</span>
                        </button>
                        <button className="ai-action-card" onClick={() => showToast('success', 'Prediction Complete', 'No significant anomalies predicted in the next 6 hours')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            <span>Predict Anomalies</span>
                        </button>
                        <button className="ai-action-card" onClick={refreshAIAnalysis}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            <span>Get Recommendations</span>
                        </button>
                        <button className="ai-action-card" onClick={exportReport}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                            <span>Generate Report</span>
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
