import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';

export default function AlertsView() {
    const {
        alertHistory, markAlertRead, markAllAlertsRead, exportAlerts,
        alertsRef, saveSettings, loadSettings, showToast
    } = useApp();

    const [severityFilter, setSeverityFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showSettings, setShowSettings] = useState(false);
    const [expandedAlert, setExpandedAlert] = useState(null);
    const [settings, setSettings] = useState({
        email: '',
        aqiThreshold: 150,
        phMin: 6.5,
        phMax: 8.5,
        tempMax: 38,
        emailEnabled: false,
        criticalOnly: false,
    });
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    // Load saved settings on mount
    useEffect(() => {
        (async () => {
            try {
                const saved = await loadSettings();
                if (saved?.alert_thresholds) {
                    setSettings(prev => ({
                        ...prev,
                        aqiThreshold: saved.alert_thresholds.aqi ?? prev.aqiThreshold,
                        phMin: saved.alert_thresholds.phMin ?? prev.phMin,
                        phMax: saved.alert_thresholds.phMax ?? prev.phMax,
                        tempMax: saved.alert_thresholds.tempMax ?? prev.tempMax,
                        email: saved.notification_email ?? prev.email,
                        emailEnabled: saved.email_enabled ?? prev.emailEnabled,
                        criticalOnly: saved.critical_only ?? prev.criticalOnly,
                    }));
                }
            } catch { /* settings not available */ }
            setSettingsLoaded(true);
        })();
    }, [loadSettings]);

    const filtered = useMemo(() => {
        let result = alertHistory;
        if (severityFilter !== 'all') result = result.filter(a => a.severity === severityFilter);
        if (typeFilter !== 'all') result = result.filter(a => a.type === typeFilter);
        return result;
    }, [alertHistory, severityFilter, typeFilter]);

    const stats = useMemo(() => {
        if (!alertsRef.current) return null;
        return alertsRef.current.getStatistics();
    }, [alertHistory, alertsRef]); // eslint-disable-line react-hooks/exhaustive-deps

    const severityFilters = ['all', 'critical', 'warning', 'info'];
    const typeFilters = ['all', 'air', 'water', 'weather', 'system'];

    const getAlertTitle = (alert) => {
        const titles = {
            air: 'Air Quality Alert',
            water: 'Water Quality Alert',
            weather: 'Weather Alert',
            system: 'System Alert',
            emergency: 'Emergency Alert',
        };
        return titles[alert.type] || 'Environmental Alert';
    };

    const getAlertIcon = (alert) => {
        const icons = {
            air: <><path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6" /></>,
            water: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
            weather: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" /></>,
            system: <><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="12" cy="12" r="3" /></>,
        };
        return icons[alert.type] || <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>;
    };

    const formatTime = (timestamp) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    const handleSaveSettings = useCallback(async () => {
        try {
            await saveSettings({
                alert_thresholds: {
                    aqi: settings.aqiThreshold,
                    phMin: settings.phMin,
                    phMax: settings.phMax,
                    tempMax: settings.tempMax,
                },
                notification_email: settings.email,
                email_enabled: settings.emailEnabled,
                critical_only: settings.criticalOnly,
            });
        } catch {
            showToast('error', 'Error', 'Failed to save settings');
        }
    }, [settings, saveSettings, showToast]);

    const clearAllAlerts = useCallback(() => {
        if (alertsRef.current) {
            alertsRef.current.alertHistory = [];
            markAllAlertsRead();
            showToast('success', 'Alerts Cleared', 'All alerts have been removed');
        }
    }, [alertsRef, markAllAlertsRead, showToast]);

    const getRecommendations = (alert) => {
        if (alert.recommendations && alert.recommendations.length > 0) return alert.recommendations;
        if (!alertsRef.current) return [];
        return alertsRef.current.getRecommendations(alert);
    };

    return (
        <section className="view active" id="view-alerts">
            <div className="view-content">
                {/* Statistics Summary */}
                {stats && (
                    <div className="alerts-stats-grid">
                        <div className="alert-stat-card">
                            <div className="alert-stat-icon total">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                            </div>
                            <div className="alert-stat-info">
                                <span className="alert-stat-value">{stats.total}</span>
                                <span className="alert-stat-label">Total Alerts</span>
                            </div>
                        </div>
                        <div className="alert-stat-card">
                            <div className="alert-stat-icon unread">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                            </div>
                            <div className="alert-stat-info">
                                <span className="alert-stat-value">{stats.unread}</span>
                                <span className="alert-stat-label">Unread</span>
                            </div>
                        </div>
                        <div className="alert-stat-card">
                            <div className="alert-stat-icon critical">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            </div>
                            <div className="alert-stat-info">
                                <span className="alert-stat-value">{stats.bySeverity.critical}</span>
                                <span className="alert-stat-label">Critical</span>
                            </div>
                        </div>
                        <div className="alert-stat-card">
                            <div className="alert-stat-icon last24">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                            </div>
                            <div className="alert-stat-info">
                                <span className="alert-stat-value">{stats.last24Hours}</span>
                                <span className="alert-stat-label">Last 24h</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters & Actions */}
                <div className="alerts-header">
                    <div className="alerts-filters-group">
                        <div className="alerts-filter-row">
                            <span className="filter-label">Severity:</span>
                            <div className="alerts-filters">
                                {severityFilters.map(f => (
                                    <button key={f} className={`filter-btn ${severityFilter === f ? 'active' : ''}`} onClick={() => setSeverityFilter(f)}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="alerts-filter-row">
                            <span className="filter-label">Type:</span>
                            <div className="alerts-filters">
                                {typeFilters.map(f => (
                                    <button key={f} className={`filter-btn type ${typeFilter === f ? 'active' : ''}`} onClick={() => setTypeFilter(f)}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="alerts-actions">
                        <button className="btn-secondary" onClick={markAllAlertsRead} title="Mark all as read">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                            <span>Mark All Read</span>
                        </button>
                        <button className="btn-secondary" onClick={exportAlerts} title="Export as CSV">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            <span>Export</span>
                        </button>
                        <button className="btn-secondary" onClick={clearAllAlerts} title="Clear all alerts">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            <span>Clear All</span>
                        </button>
                        <button className={`btn-secondary ${showSettings ? 'active-toggle' : ''}`} onClick={() => setShowSettings(!showSettings)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                            <span>Settings</span>
                        </button>
                    </div>
                </div>

                {/* Settings Panel */}
                {showSettings && settingsLoaded && (
                    <div className="alert-settings-panel">
                        <div className="settings-panel-header">
                            <h3>Alert Configuration</h3>
                            <button className="btn-primary" onClick={handleSaveSettings}>Save Settings</button>
                        </div>
                        <div className="settings-form">
                            <div className="settings-columns">
                                <div className="settings-col">
                                    <h4>Notification Settings</h4>
                                    <div className="form-group">
                                        <label>Email Notifications</label>
                                        <input
                                            type="email"
                                            placeholder="your@email.com"
                                            value={settings.email}
                                            onChange={e => setSettings(s => ({ ...s, email: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group checkbox">
                                        <input
                                            type="checkbox"
                                            checked={settings.emailEnabled}
                                            onChange={e => setSettings(s => ({ ...s, emailEnabled: e.target.checked }))}
                                            id="email-enabled"
                                        />
                                        <label htmlFor="email-enabled">Enable email notifications</label>
                                    </div>
                                    <div className="form-group checkbox">
                                        <input
                                            type="checkbox"
                                            checked={settings.criticalOnly}
                                            onChange={e => setSettings(s => ({ ...s, criticalOnly: e.target.checked }))}
                                            id="critical-only"
                                        />
                                        <label htmlFor="critical-only">Critical alerts only</label>
                                    </div>
                                </div>
                                <div className="settings-col">
                                    <h4>Alert Thresholds</h4>
                                    <div className="form-group">
                                        <label>AQI Threshold <span className="range-value">{settings.aqiThreshold}</span></label>
                                        <input
                                            type="range" min="50" max="300" step="10"
                                            value={settings.aqiThreshold}
                                            onChange={e => setSettings(s => ({ ...s, aqiThreshold: Number(e.target.value) }))}
                                        />
                                        <div className="range-labels"><span>50 (Good)</span><span>300 (Hazardous)</span></div>
                                    </div>
                                    <div className="form-group">
                                        <label>Max Temperature <span className="range-value">{settings.tempMax}°C</span></label>
                                        <input
                                            type="range" min="30" max="50" step="1"
                                            value={settings.tempMax}
                                            onChange={e => setSettings(s => ({ ...s, tempMax: Number(e.target.value) }))}
                                        />
                                        <div className="range-labels"><span>30°C</span><span>50°C</span></div>
                                    </div>
                                    <div className="form-group">
                                        <label>Water pH Range <span className="range-value">{settings.phMin} - {settings.phMax}</span></label>
                                        <div className="range-dual">
                                            <input
                                                type="number" min="0" max="7" step="0.1"
                                                value={settings.phMin}
                                                onChange={e => setSettings(s => ({ ...s, phMin: Number(e.target.value) }))}
                                            />
                                            <span>to</span>
                                            <input
                                                type="number" min="7" max="14" step="0.1"
                                                value={settings.phMax}
                                                onChange={e => setSettings(s => ({ ...s, phMax: Number(e.target.value) }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Alert Timeline */}
                <div className="alerts-timeline">
                    {filtered.length === 0 ? (
                        <div className="empty-state">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                            <p>No {severityFilter !== 'all' ? severityFilter : ''} {typeFilter !== 'all' ? typeFilter : ''} alerts recorded</p>
                        </div>
                    ) : filtered.map(alert => (
                        <div
                            key={alert.id}
                            className={`timeline-item ${alert.read ? '' : 'unread'} ${expandedAlert === alert.id ? 'expanded' : ''}`}
                            onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                        >
                            <div className={`timeline-icon ${alert.severity}`}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    {getAlertIcon(alert)}
                                </svg>
                            </div>
                            <div className="timeline-content">
                                <div className="timeline-header">
                                    <div className="timeline-title-group">
                                        <span className="timeline-title">{getAlertTitle(alert)}</span>
                                        <span className={`timeline-severity-badge ${alert.severity}`}>{alert.severity}</span>
                                    </div>
                                    <span className="timeline-time">{formatTime(alert.timestamp)}</span>
                                </div>
                                <p className="timeline-message">{alert.message}</p>

                                {alert.value !== undefined && (
                                    <div className="timeline-meta">
                                        <span className="meta-item">Value: <strong>{alert.value}</strong></span>
                                        {alert.threshold && <span className="meta-item">Threshold: <strong>{alert.threshold}</strong></span>}
                                    </div>
                                )}

                                {expandedAlert === alert.id && (
                                    <div className="timeline-expanded">
                                        {getRecommendations(alert).length > 0 && (
                                            <div className="timeline-recommendations">
                                                <span className="recs-title">Recommendations:</span>
                                                <ul>
                                                    {getRecommendations(alert).map((rec, i) => (
                                                        <li key={i}>{rec}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <div className="timeline-timestamp">
                                            Full timestamp: {new Date(alert.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                )}

                                <div className="timeline-actions" onClick={e => e.stopPropagation()}>
                                    {!alert.read && (
                                        <button className="timeline-btn" onClick={() => markAlertRead(alert.id)}>Mark as read</button>
                                    )}
                                    <button className="timeline-btn dismiss" onClick={() => {
                                        alertsRef.current.alertHistory = alertsRef.current.alertHistory.filter(a => a.id !== alert.id);
                                        markAlertRead(alert.id); // triggers re-render
                                        showToast('success', 'Dismissed', 'Alert removed');
                                    }}>Dismiss</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
