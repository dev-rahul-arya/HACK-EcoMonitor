import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

export default function AlertsView() {
    const {
        alertHistory, markAlertRead, markAllAlertsRead, exportAlerts,
        alertsRef, saveSettings, loadSettings, showToast, sendEmergencyAlert
    } = useApp();
    const { t } = useLanguage();

    const [severityFilter, setSeverityFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [detailAlert, setDetailAlert] = useState(null);
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
        const titles = { air: t('airQualityAlert'), water: t('waterQualityAlert'), weather: t('weatherAlert'), system: t('systemAlert'), emergency: t('systemAlert') };
        return titles[alert.type] || t('alerts');
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
                alert_thresholds: { aqi: settings.aqiThreshold, phMin: settings.phMin, phMax: settings.phMax, tempMax: settings.tempMax },
                notification_email: settings.email,
                email_enabled: settings.emailEnabled,
                critical_only: settings.criticalOnly,
            });
            setShowSettingsModal(false);
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

    const getEmergencyActions = (alert) => {
        const actions = [];
        if (alert.severity === 'critical' || alert.severity === 'warning') {
            actions.push({ label: 'Activate Alarm', icon: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>, color: '#ef4444' });
        }
        if (alert.type === 'air') {
            actions.push({ label: 'Close Ventilation', icon: <><path d="M17.7 7.7a7.5 7.5 0 1 0-10.6 10.6" /><path d="M8 16h.01" /></>, color: '#f59e0b' });
            actions.push({ label: 'Activate Air Purifiers', icon: <><path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6" /></>, color: '#3b82f6' });
        }
        if (alert.type === 'water') {
            actions.push({ label: 'Start Watering System', icon: <><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></>, color: '#06b6d4' });
            actions.push({ label: 'Shut Off Water Supply', icon: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>, color: '#ef4444' });
        }
        if (alert.type === 'weather') {
            actions.push({ label: 'Send Evacuation Notice', icon: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>, color: '#f97316' });
            actions.push({ label: 'Activate Weather Shelter', icon: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>, color: '#8b5cf6' });
        }
        if (alert.severity === 'critical') {
            actions.push({ label: 'Emergency Broadcast', icon: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></>, color: '#dc2626' });
        }
        return actions;
    };

    const handleEmergencyAction = useCallback((action, alert) => {
        sendEmergencyAlert({
            action: action.label,
            alertId: alert.id,
            alertType: alert.type,
            severity: alert.severity,
            message: alert.message,
            timestamp: new Date().toISOString(),
        });
        showToast('warning', action.label, `${action.label} has been activated for ${alert.type} alert`);
    }, [sendEmergencyAlert, showToast]);

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
                                <span className="alert-stat-label">{t('totalAlerts')}</span>
                            </div>
                        </div>
                        <div className="alert-stat-card">
                            <div className="alert-stat-icon unread">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                            </div>
                            <div className="alert-stat-info">
                                <span className="alert-stat-value">{stats.unread}</span>
                                <span className="alert-stat-label">{t('unread')}</span>
                            </div>
                        </div>
                        <div className="alert-stat-card">
                            <div className="alert-stat-icon critical">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            </div>
                            <div className="alert-stat-info">
                                <span className="alert-stat-value">{stats.bySeverity.critical}</span>
                                <span className="alert-stat-label">{t('critical')}</span>
                            </div>
                        </div>
                        <div className="alert-stat-card">
                            <div className="alert-stat-icon last24">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                            </div>
                            <div className="alert-stat-info">
                                <span className="alert-stat-value">{stats.last24Hours}</span>
                                <span className="alert-stat-label">{t('last24h')}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters & Actions */}
                <div className="alerts-header">
                    <div className="alerts-filters-group">
                        <div className="alerts-filter-row">
                            <span className="filter-label">{t('severity')}:</span>
                            <div className="alerts-filters">
                                {severityFilters.map(f => (
                                    <button key={f} className={`filter-btn ${severityFilter === f ? 'active' : ''}`} onClick={() => setSeverityFilter(f)}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="alerts-filter-row">
                            <span className="filter-label">{t('type')}:</span>
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
                        <button className="btn-secondary" onClick={markAllAlertsRead}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                            <span>{t('markAllRead')}</span>
                        </button>
                        <button className="btn-secondary" onClick={exportAlerts}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            <span>{t('export')}</span>
                        </button>
                        <button className="btn-secondary" onClick={clearAllAlerts}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            <span>{t('clearAll')}</span>
                        </button>
                        <button className="btn-secondary" onClick={() => setShowSettingsModal(true)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                            <span>{t('settings')}</span>
                        </button>
                    </div>
                </div>

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
                            className={`timeline-item ${alert.read ? '' : 'unread'}`}
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
                                <div className="timeline-actions">
                                    {!alert.read && (
                                        <button className="timeline-btn" onClick={() => markAlertRead(alert.id)}>{t('markAsRead')}</button>
                                    )}
                                    <button className="timeline-btn" onClick={() => setDetailAlert(alert)}>{t('moreDetails')}</button>
                                    <button className="timeline-btn dismiss" onClick={() => {
                                        alertsRef.current.alertHistory = alertsRef.current.alertHistory.filter(a => a.id !== alert.id);
                                        markAlertRead(alert.id);
                                        showToast('success', 'Dismissed', 'Alert removed');
                                    }}>{t('dismiss')}</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detail Modal */}
            {detailAlert && (
                <div className="modal-overlay" onClick={() => setDetailAlert(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title-group">
                                <div className={`timeline-icon ${detailAlert.severity}`} style={{width:36,height:36}}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{getAlertIcon(detailAlert)}</svg>
                                </div>
                                <div>
                                    <h3>{getAlertTitle(detailAlert)}</h3>
                                    <span className={`timeline-severity-badge ${detailAlert.severity}`}>{detailAlert.severity}</span>
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => setDetailAlert(null)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-section">
                                <h4>{t('description')}</h4>
                                <p>{detailAlert.message}</p>
                            </div>
                            {detailAlert.value !== undefined && (
                                <div className="modal-section">
                                    <h4>{t('metrics')}</h4>
                                    <div className="modal-metrics">
                                        <div className="modal-metric">
                                            <span className="modal-metric-label">{t('currentValue')}</span>
                                            <span className="modal-metric-value">{detailAlert.value}</span>
                                        </div>
                                        {detailAlert.threshold && (
                                            <div className="modal-metric">
                                                <span className="modal-metric-label">{t('threshold')}</span>
                                                <span className="modal-metric-value">{detailAlert.threshold}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {getRecommendations(detailAlert).length > 0 && (
                                <div className="modal-section">
                                    <h4>{t('recommendations')}</h4>
                                    <ul className="modal-rec-list">
                                        {getRecommendations(detailAlert).map((rec, i) => (
                                            <li key={i}>{rec}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {getEmergencyActions(detailAlert).length > 0 && (
                                <div className="modal-section">
                                    <h4>{t('emergencyActions')}</h4>
                                    <div className="emergency-actions-grid">
                                        {getEmergencyActions(detailAlert).map((action, i) => (
                                            <button
                                                key={i}
                                                className="emergency-action-btn"
                                                style={{ '--action-color': action.color }}
                                                onClick={() => handleEmergencyAction(action, detailAlert)}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{action.icon}</svg>
                                                <span>{action.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="modal-section">
                                <h4>{t('timestamp')}</h4>
                                <p className="modal-timestamp">{new Date(detailAlert.timestamp).toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            {!detailAlert.read && (
                                <button className="btn-primary" onClick={() => { markAlertRead(detailAlert.id); setDetailAlert(null); }}>{t('markAsRead')}</button>
                            )}
                            <button className="btn-secondary" onClick={() => setDetailAlert(null)}>{t('close')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && settingsLoaded && (
                <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
                    <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title-group">
                                <div className="settings-icon-wrap">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                                </div>
                                <h3>{t('alertConfiguration')}</h3>
                            </div>
                            <button className="modal-close" onClick={() => setShowSettingsModal(false)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="settings-columns">
                                <div className="settings-col">
                                    <div className="settings-section-header">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                                        <h4>{t('notificationSettings')}</h4>
                                    </div>
                                    <div className="settings-form-group">
                                        <label className="settings-label">{t('emailNotifications')}</label>
                                        <input type="email" className="settings-input" placeholder="your@email.com" value={settings.email} onChange={e => setSettings(s => ({ ...s, email: e.target.value }))} />
                                    </div>
                                    <div className="settings-toggle-group">
                                        <label className="settings-toggle" htmlFor="email-enabled">
                                            <input type="checkbox" checked={settings.emailEnabled} onChange={e => setSettings(s => ({ ...s, emailEnabled: e.target.checked }))} id="email-enabled" />
                                            <span className="toggle-slider"></span>
                                            <span className="toggle-text">{t('enableEmail')}</span>
                                        </label>
                                    </div>
                                    <div className="settings-toggle-group">
                                        <label className="settings-toggle" htmlFor="critical-only">
                                            <input type="checkbox" checked={settings.criticalOnly} onChange={e => setSettings(s => ({ ...s, criticalOnly: e.target.checked }))} id="critical-only" />
                                            <span className="toggle-slider"></span>
                                            <span className="toggle-text">{t('criticalOnly')}</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="settings-col">
                                    <div className="settings-section-header">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                                        <h4>{t('alertThresholds')}</h4>
                                    </div>
                                    <div className="settings-form-group">
                                        <label className="settings-label">{t('aqiThreshold')} <span className="settings-range-badge">{settings.aqiThreshold}</span></label>
                                        <input type="range" className="settings-range" min="50" max="300" step="10" value={settings.aqiThreshold} onChange={e => setSettings(s => ({ ...s, aqiThreshold: Number(e.target.value) }))} />
                                        <div className="range-labels"><span>50 (Good)</span><span>300 (Hazardous)</span></div>
                                    </div>
                                    <div className="settings-form-group">
                                        <label className="settings-label">{t('maxTemperature')} <span className="settings-range-badge">{settings.tempMax}°C</span></label>
                                        <input type="range" className="settings-range" min="30" max="50" step="1" value={settings.tempMax} onChange={e => setSettings(s => ({ ...s, tempMax: Number(e.target.value) }))} />
                                        <div className="range-labels"><span>30°C</span><span>50°C</span></div>
                                    </div>
                                    <div className="settings-form-group">
                                        <label className="settings-label">{t('waterPhRange')} <span className="settings-range-badge">{settings.phMin} - {settings.phMax}</span></label>
                                        <div className="range-dual">
                                            <input type="number" className="settings-number-input" min="0" max="7" step="0.1" value={settings.phMin} onChange={e => setSettings(s => ({ ...s, phMin: Number(e.target.value) }))} />
                                            <span className="range-separator">to</span>
                                            <input type="number" className="settings-number-input" min="7" max="14" step="0.1" value={settings.phMax} onChange={e => setSettings(s => ({ ...s, phMax: Number(e.target.value) }))} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-primary" onClick={handleSaveSettings}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                                {t('saveSettings')}
                            </button>
                            <button className="btn-secondary" onClick={() => setShowSettingsModal(false)}>{t('cancel')}</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
