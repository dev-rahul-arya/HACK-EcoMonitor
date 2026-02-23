import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function AlertsView() {
    const { alertHistory, markAlertRead, markAllAlertsRead, exportAlerts } = useApp();
    const [filter, setFilter] = useState('all');
    const [showSettings, setShowSettings] = useState(false);

    const filtered = filter === 'all' ? alertHistory : alertHistory.filter(a => a.severity === filter);
    const filters = ['all', 'critical', 'warning', 'info'];

    const getAlertTitle = (alert) => {
        const titles = { air: 'Air Quality Alert', water: 'Water Quality Alert', weather: 'Weather Alert', system: 'System Alert' };
        return titles[alert.type] || 'Environmental Alert';
    };

    const formatTime = (timestamp) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    return (
        <section className="view active" id="view-alerts">
            <div className="view-content">
                <div className="alerts-header">
                    <div className="alerts-filters">
                        {filters.map(f => (
                            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                    <div className="alerts-actions">
                        <button className="btn-secondary" onClick={markAllAlertsRead}>Mark All Read</button>
                        <button className="btn-secondary" onClick={exportAlerts}>Export Alerts</button>
                        <button className="btn-secondary" onClick={() => setShowSettings(!showSettings)}>Settings</button>
                    </div>
                </div>

                <div className="alerts-timeline">
                    {filtered.length === 0 ? (
                        <div className="empty-state">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                            <p>No {filter !== 'all' ? filter : ''} alerts recorded</p>
                        </div>
                    ) : filtered.map(alert => (
                        <div key={alert.id} className={`timeline-item ${alert.read ? '' : 'unread'}`}>
                            <div className={`timeline-icon ${alert.severity}`}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            </div>
                            <div className="timeline-content">
                                <div className="timeline-header">
                                    <span className="timeline-title">{getAlertTitle(alert)}</span>
                                    <span className="timeline-time">{formatTime(alert.timestamp)}</span>
                                </div>
                                <p className="timeline-message">{alert.message}</p>
                                <div className="timeline-actions">
                                    {!alert.read && <button className="timeline-btn" onClick={() => markAlertRead(alert.id)}>Mark as read</button>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {showSettings && (
                    <div className="alert-settings-panel">
                        <h3>Alert Configuration</h3>
                        <div className="settings-form">
                            <div className="form-group">
                                <label>Email Notifications</label>
                                <input type="email" placeholder="your@email.com" />
                            </div>
                            <div className="form-group">
                                <label>AQI Threshold</label>
                                <input type="range" min="50" max="300" defaultValue="150" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
