/**
 * EcoMonitor - n8n Webhook Integration Module
 */

import CONFIG from './config.js';

class AlertService {
    constructor() {
        this.webhookUrl = CONFIG.N8N.WEBHOOK_URL;
        this.enabled = CONFIG.N8N.ENABLED && this.webhookUrl && this.webhookUrl.length > 10;
        this.alertQueue = [];
        this.alertHistory = [];
        this.maxHistorySize = 100;
        this.rateLimitDelay = 30000;
        this.lastAlertTimes = new Map();
    }

    async sendAlert(alert) {
        this.addToHistory(alert);
        if (this.isRateLimited(alert)) return { success: false, reason: 'rate_limited' };
        if (!this.enabled) return { success: false, reason: 'not_configured' };
        try {
            const response = await this.callWebhook(alert);
            this.lastAlertTimes.set(alert.type, Date.now());
            return { success: true, response };
        } catch (error) {
            this.alertQueue.push(alert);
            return { success: false, reason: 'webhook_error', error };
        }
    }

    async callWebhook(alert) {
        const payload = {
            timestamp: new Date().toISOString(),
            alertId: this.generateAlertId(),
            type: alert.type, severity: alert.severity,
            title: alert.title || this.generateTitle(alert),
            message: alert.message, value: alert.value, threshold: alert.threshold,
            location: alert.location || 'All Locations', recommendations: alert.recommendations || [],
            metadata: { source: 'EcoMonitor', version: '1.0.0', environment: 'production' }
        };
        const response = await fetch(this.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`Webhook request failed: ${response.status}`);
        return await response.json().catch(() => ({ status: 'sent' }));
    }

    generateAlertId() { return `ECO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`; }

    generateTitle(alert) {
        const titles = {
            air: { critical: '🚨 Critical Air Quality Alert', warning: '⚠️ Air Quality Warning' },
            water: { critical: '🚨 Critical Water Quality Alert', warning: '⚠️ Water Quality Warning' },
            weather: { critical: '🚨 Severe Weather Alert', warning: '⚠️ Weather Advisory' },
            system: { critical: '🚨 System Critical Alert', warning: '⚠️ System Warning' }
        };
        return titles[alert.type]?.[alert.severity] || `Environmental Alert: ${alert.type}`;
    }

    isRateLimited(alert) {
        const lastTime = this.lastAlertTimes.get(alert.type);
        if (!lastTime) return false;
        return Date.now() - lastTime < this.rateLimitDelay;
    }

    addToHistory(alert) {
        this.alertHistory.unshift({ ...alert, id: this.generateAlertId(), timestamp: new Date().toISOString(), read: false });
        if (this.alertHistory.length > this.maxHistorySize) this.alertHistory = this.alertHistory.slice(0, this.maxHistorySize);
        this.persistToStorage();
    }

    persistToStorage() {
        try {
            localStorage.setItem('eco_alert_history', JSON.stringify(this.alertHistory));
        } catch { /* storage full or unavailable */ }
    }

    getAlertHistory() { return this.alertHistory; }
    getUnreadCount() { return this.alertHistory.filter(a => !a.read).length; }
    markAsRead(alertId) { const alert = this.alertHistory.find(a => a.id === alertId); if (alert) { alert.read = true; this.persistToStorage(); } }
    markAllAsRead() { this.alertHistory.forEach(a => a.read = true); this.persistToStorage(); }

    async processAnomalies(anomalies) {
        const sentAlerts = [];
        for (const anomaly of anomalies) {
            const alert = { type: anomaly.type, severity: anomaly.severity, message: anomaly.message, value: anomaly.value, threshold: anomaly.threshold, recommendations: this.getRecommendations(anomaly) };
            const result = await this.sendAlert(alert);
            if (result.success) sentAlerts.push(alert);
        }
        return sentAlerts;
    }

    getRecommendations(anomaly) {
        const recommendations = {
            air: ['Limit outdoor activities, especially for sensitive groups', 'Keep windows and doors closed', 'Use air purifiers if available', 'Monitor for respiratory symptoms'],
            water: ['Avoid using tap water for drinking until cleared', 'Use bottled water for consumption', 'Report any unusual water appearance or odor', 'Wait for official clearance before resuming normal use'],
            weather: ['Stay indoors if possible', 'Follow local emergency guidance', 'Prepare emergency supplies', 'Check on vulnerable neighbors']
        };
        return recommendations[anomaly.type] || ['Monitor conditions and follow local guidance'];
    }

    async sendEmergencyAlert(emergencyData) {
        return this.sendAlert({
            type: 'emergency', severity: 'critical',
            message: emergencyData.message || 'Emergency protocol activated',
            options: emergencyData.options, activatedBy: 'EcoMonitor Dashboard',
            location: emergencyData.location || 'All Locations',
            recommendations: ['Follow emergency response procedures', 'Evacuate if instructed by authorities', 'Stay tuned to official channels for updates', 'Do not return until all-clear is given']
        });
    }

    async sendAlertAction(actionData) {
        if (!this.enabled) return { success: true, simulated: true };
        const payload = {
            timestamp: actionData.timestamp || new Date().toISOString(),
            actionId: this.generateAlertId(), type: 'user_action',
            title: actionData.title, action: actionData.action,
            message: `User initiated response to: ${actionData.title}`,
            metadata: { source: 'EcoMonitor', version: '1.0.0', actionType: 'alert_response' }
        };
        const response = await fetch(this.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`Action webhook request failed: ${response.status}`);
        return await response.json().catch(() => ({ status: 'action_sent' }));
    }

    getStatistics() {
        const now = Date.now();
        const oneDayAgo = now - 86400000;
        const oneWeekAgo = now - 604800000;
        return {
            total: this.alertHistory.length, unread: this.getUnreadCount(),
            last24Hours: this.alertHistory.filter(a => new Date(a.timestamp).getTime() > oneDayAgo).length,
            lastWeek: this.alertHistory.filter(a => new Date(a.timestamp).getTime() > oneWeekAgo).length,
            bySeverity: { critical: this.alertHistory.filter(a => a.severity === 'critical').length, warning: this.alertHistory.filter(a => a.severity === 'warning').length, info: this.alertHistory.filter(a => a.severity === 'info').length },
            byType: { air: this.alertHistory.filter(a => a.type === 'air').length, water: this.alertHistory.filter(a => a.type === 'water').length, weather: this.alertHistory.filter(a => a.type === 'weather').length },
            queuedAlerts: this.alertQueue.length
        };
    }

    filterAlerts(filter) {
        let filtered = [...this.alertHistory];
        if (filter.type && filter.type !== 'all') filtered = filtered.filter(a => a.type === filter.type);
        if (filter.severity && filter.severity !== 'all') filtered = filtered.filter(a => a.severity === filter.severity);
        if (filter.read !== undefined) filtered = filtered.filter(a => a.read === filter.read);
        return filtered;
    }

    exportToCSV() {
        const headers = ['ID', 'Timestamp', 'Type', 'Severity', 'Message', 'Value', 'Threshold'];
        const rows = this.alertHistory.map(a => [a.id, a.timestamp, a.type, a.severity, `"${a.message}"`, a.value || '', a.threshold || '']);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
}

export default AlertService;
