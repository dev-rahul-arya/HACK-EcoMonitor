/**
 * EcoMonitor - Supabase Integration Module
 * Handles data persistence and real-time subscriptions
 */

import CONFIG from '../config.js';

class SupabaseService {
    constructor() {
        this.url = CONFIG.SUPABASE.URL;
        this.anonKey = CONFIG.SUPABASE.ANON_KEY;
        this.isConfigured = this.url && this.anonKey && 
                           this.url.length > 10 && this.anonKey.length > 10;
        this.client = null;
        this.subscriptions = [];
    }

    async initialize() {
        if (!this.isConfigured) {
            console.log('Supabase not configured, using local storage fallback');
            return false;
        }

        try {
            // Dynamic import of Supabase client
            const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
            this.client = createClient(this.url, this.anonKey);
            console.log('Supabase client initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            return false;
        }
    }

    // Sensor Data Operations
    async saveSensorReading(reading) {
        if (!this.client) {
            return this.saveToLocalStorage('sensor_readings', reading);
        }

        try {
            const { data, error } = await this.client
                .from('sensor_readings')
                .insert([{
                    timestamp: reading.timestamp,
                    air_data: reading.air,
                    weather_data: reading.weather,
                    water_data: reading.water,
                    location: reading.location || 'default'
                }]);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Failed to save sensor reading:', error);
            return this.saveToLocalStorage('sensor_readings', reading);
        }
    }

    async getRecentReadings(hours = 24, location = null) {
        if (!this.client) {
            return this.getFromLocalStorage('sensor_readings', hours);
        }

        try {
            const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
            
            let query = this.client
                .from('sensor_readings')
                .select('*')
                .gte('timestamp', since)
                .order('timestamp', { ascending: false });

            if (location) {
                query = query.eq('location', location);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Failed to get readings:', error);
            return this.getFromLocalStorage('sensor_readings', hours);
        }
    }

    // Alert Operations
    async saveAlert(alert) {
        if (!this.client) {
            return this.saveToLocalStorage('alerts', alert);
        }

        try {
            const { data, error } = await this.client
                .from('alerts')
                .insert([{
                    alert_id: alert.id,
                    type: alert.type,
                    severity: alert.severity,
                    message: alert.message,
                    value: alert.value,
                    threshold: alert.threshold,
                    timestamp: alert.timestamp,
                    read: false,
                    location: alert.location
                }]);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Failed to save alert:', error);
            return this.saveToLocalStorage('alerts', alert);
        }
    }

    async getAlerts(filter = {}) {
        if (!this.client) {
            return this.getFromLocalStorage('alerts');
        }

        try {
            let query = this.client
                .from('alerts')
                .select('*')
                .order('timestamp', { ascending: false });

            if (filter.type) query = query.eq('type', filter.type);
            if (filter.severity) query = query.eq('severity', filter.severity);
            if (filter.unreadOnly) query = query.eq('read', false);
            if (filter.limit) query = query.limit(filter.limit);

            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Failed to get alerts:', error);
            return this.getFromLocalStorage('alerts');
        }
    }

    async markAlertRead(alertId) {
        if (!this.client) {
            return this.updateLocalStorage('alerts', alertId, { read: true });
        }

        try {
            const { error } = await this.client
                .from('alerts')
                .update({ read: true })
                .eq('alert_id', alertId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Failed to mark alert read:', error);
            return { success: false, error };
        }
    }

    // AI Reports Operations
    async saveAIReport(report) {
        if (!this.client) {
            return this.saveToLocalStorage('ai_reports', report);
        }

        try {
            const { data, error } = await this.client
                .from('ai_reports')
                .insert([{
                    generated_at: report.generatedAt,
                    summary: report.analysis.summary,
                    concerns: report.analysis.concerns,
                    recommendations: report.analysis.recommendations,
                    prediction: report.analysis.prediction,
                    sensor_snapshot: report.currentReadings,
                    data_quality: report.dataQuality
                }]);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Failed to save AI report:', error);
            return this.saveToLocalStorage('ai_reports', report);
        }
    }

    // User Settings Operations
    async saveUserSettings(settings) {
        if (!this.client) {
            localStorage.setItem('ecomonitor_settings', JSON.stringify(settings));
            return { success: true };
        }

        try {
            const { data, error } = await this.client
                .from('user_settings')
                .upsert([{
                    id: 'default',
                    alert_email: settings.email,
                    aqi_threshold: settings.aqiThreshold,
                    temp_threshold: settings.tempThreshold,
                    instant_alerts: settings.instantAlerts,
                    updated_at: new Date().toISOString()
                }]);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Failed to save settings:', error);
            localStorage.setItem('ecomonitor_settings', JSON.stringify(settings));
            return { success: true };
        }
    }

    async getUserSettings() {
        if (!this.client) {
            const settings = localStorage.getItem('ecomonitor_settings');
            return settings ? JSON.parse(settings) : null;
        }

        try {
            const { data, error } = await this.client
                .from('user_settings')
                .select('*')
                .eq('id', 'default')
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (error) {
            console.error('Failed to get settings:', error);
            const settings = localStorage.getItem('ecomonitor_settings');
            return settings ? JSON.parse(settings) : null;
        }
    }

    // Real-time Subscriptions
    subscribeToAlerts(callback) {
        if (!this.client) {
            console.log('Real-time subscriptions not available without Supabase');
            return null;
        }

        const subscription = this.client
            .channel('alerts_channel')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'alerts' },
                (payload) => {
                    callback(payload.new);
                }
            )
            .subscribe();

        this.subscriptions.push(subscription);
        return subscription;
    }

    subscribeToSensorData(callback) {
        if (!this.client) {
            console.log('Real-time subscriptions not available without Supabase');
            return null;
        }

        const subscription = this.client
            .channel('sensor_channel')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'sensor_readings' },
                (payload) => {
                    callback(payload.new);
                }
            )
            .subscribe();

        this.subscriptions.push(subscription);
        return subscription;
    }

    unsubscribeAll() {
        this.subscriptions.forEach(sub => {
            if (sub && typeof sub.unsubscribe === 'function') {
                sub.unsubscribe();
            }
        });
        this.subscriptions = [];
    }

    // Local Storage Fallback Methods
    saveToLocalStorage(key, data) {
        try {
            const existing = localStorage.getItem(`ecomonitor_${key}`);
            const items = existing ? JSON.parse(existing) : [];
            items.unshift({ ...data, _localId: Date.now() });
            
            // Keep only last 1000 items
            const trimmed = items.slice(0, 1000);
            localStorage.setItem(`ecomonitor_${key}`, JSON.stringify(trimmed));
            
            return { success: true, local: true };
        } catch (error) {
            console.error('Local storage save failed:', error);
            return { success: false, error };
        }
    }

    getFromLocalStorage(key, hoursAgo = null) {
        try {
            const data = localStorage.getItem(`ecomonitor_${key}`);
            if (!data) return [];
            
            let items = JSON.parse(data);
            
            if (hoursAgo) {
                const since = Date.now() - hoursAgo * 60 * 60 * 1000;
                items = items.filter(item => {
                    const timestamp = item.timestamp || item._localId;
                    return new Date(timestamp).getTime() > since;
                });
            }
            
            return items;
        } catch (error) {
            console.error('Local storage read failed:', error);
            return [];
        }
    }

    updateLocalStorage(key, id, updates) {
        try {
            const data = localStorage.getItem(`ecomonitor_${key}`);
            if (!data) return { success: false };
            
            const items = JSON.parse(data);
            const index = items.findIndex(item => 
                item.id === id || item.alert_id === id || item._localId === id
            );
            
            if (index !== -1) {
                items[index] = { ...items[index], ...updates };
                localStorage.setItem(`ecomonitor_${key}`, JSON.stringify(items));
            }
            
            return { success: true };
        } catch (error) {
            console.error('Local storage update failed:', error);
            return { success: false, error };
        }
    }

    // Data Export
    async exportAllData() {
        const data = {
            exportedAt: new Date().toISOString(),
            sensorReadings: await this.getRecentReadings(168), // Last week
            alerts: await this.getAlerts({ limit: 500 }),
            settings: await this.getUserSettings()
        };

        return data;
    }

    // Clear old data
    async cleanupOldData(daysToKeep = 30) {
        const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

        if (this.client) {
            try {
                await this.client
                    .from('sensor_readings')
                    .delete()
                    .lt('timestamp', cutoff);

                await this.client
                    .from('alerts')
                    .delete()
                    .lt('timestamp', cutoff);

                console.log('Old data cleaned up');
            } catch (error) {
                console.error('Cleanup failed:', error);
            }
        }

        // Clean local storage too
        ['sensor_readings', 'alerts'].forEach(key => {
            const data = this.getFromLocalStorage(key);
            const filtered = data.filter(item => {
                const timestamp = item.timestamp || item._localId;
                return new Date(timestamp) > new Date(cutoff);
            });
            localStorage.setItem(`ecomonitor_${key}`, JSON.stringify(filtered));
        });
    }

    // Health check
    async checkConnection() {
        if (!this.client) {
            return { connected: false, reason: 'not_configured' };
        }

        try {
            const { error } = await this.client
                .from('sensor_readings')
                .select('count')
                .limit(1);

            return { connected: !error, error };
        } catch (error) {
            return { connected: false, error };
        }
    }
}

export default SupabaseService;
