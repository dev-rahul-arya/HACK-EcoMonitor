/**
 * EcoMonitor - Supabase Integration Module
 */

import CONFIG from './config.js';

class SupabaseService {
    constructor() {
        this.url = CONFIG.SUPABASE.URL;
        this.anonKey = CONFIG.SUPABASE.ANON_KEY;
        this.isConfigured = this.url && this.anonKey && this.url.length > 10 && this.anonKey.length > 10;
        this.client = null;
        this.subscriptions = [];
    }

    async initialize() {
        if (!this.isConfigured) { console.log('Supabase not configured, using local storage fallback'); return false; }
        try {
            const { createClient } = await import('@supabase/supabase-js');
            this.client = createClient(this.url, this.anonKey);
            return true;
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            return false;
        }
    }

    async getSupabaseClient() {
        if (this.client) return this.client;
        if (!this.isConfigured) return null;
        try {
            const { createClient } = await import('@supabase/supabase-js');
            this.client = createClient(this.url, this.anonKey);
            return this.client;
        } catch { return null; }
    }

    async saveSensorReading(reading) {
        if (!this.client) return this.saveToLocalStorage('sensor_readings', reading);
        try {
            const { data, error } = await this.client.from('sensor_readings').insert([{ timestamp: reading.timestamp, air_data: reading.air, weather_data: reading.weather, water_data: reading.water, location: reading.location || 'default' }]);
            if (error) throw error;
            return { success: true, data };
        } catch { return this.saveToLocalStorage('sensor_readings', reading); }
    }

    async getRecentReadings(hours = 24, location = null) {
        if (!this.client) return this.getFromLocalStorage('sensor_readings', hours);
        try {
            const since = new Date(Date.now() - hours * 3600000).toISOString();
            let query = this.client.from('sensor_readings').select('*').gte('timestamp', since).order('timestamp', { ascending: false });
            if (location) query = query.eq('location', location);
            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch { return this.getFromLocalStorage('sensor_readings', hours); }
    }

    async saveAlert(alert) {
        if (!this.client) return this.saveToLocalStorage('alerts', alert);
        try {
            const { data, error } = await this.client.from('alerts').insert([{ alert_id: alert.id, type: alert.type, severity: alert.severity, message: alert.message, value: alert.value, threshold: alert.threshold, timestamp: alert.timestamp, read: false, location: alert.location }]);
            if (error) throw error;
            return { success: true, data };
        } catch { return this.saveToLocalStorage('alerts', alert); }
    }

    async saveUserSettings(settings) {
        if (!this.client) { localStorage.setItem('ecomonitor_settings', JSON.stringify(settings)); return { success: true }; }
        try {
            const { data, error } = await this.client.from('user_settings').upsert([{ id: 'default', alert_email: settings.email, aqi_threshold: settings.aqiThreshold, temp_threshold: settings.tempThreshold, instant_alerts: settings.instantAlerts, updated_at: new Date().toISOString() }]);
            if (error) throw error;
            return { success: true, data };
        } catch { localStorage.setItem('ecomonitor_settings', JSON.stringify(settings)); return { success: true }; }
    }

    async getUserSettings() {
        if (!this.client) { const s = localStorage.getItem('ecomonitor_settings'); return s ? JSON.parse(s) : null; }
        try {
            const { data, error } = await this.client.from('user_settings').select('*').eq('id', 'default').single();
            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch { const s = localStorage.getItem('ecomonitor_settings'); return s ? JSON.parse(s) : null; }
    }

    async checkConnection() {
        if (!this.client) return { connected: false, reason: 'not_configured' };
        try {
            const { data, error } = await this.client.from('sensor_readings').select('*').limit(1);
            if (error) {
                if (error.code === '42P01') return { connected: true, tablesExist: false };
                return { connected: false, error };
            }
            return { connected: true, tablesExist: true, recordCount: data?.length || 0 };
        } catch (error) { return { connected: false, error }; }
    }

    saveToLocalStorage(key, data) {
        try {
            const existing = localStorage.getItem(`ecomonitor_${key}`);
            const items = existing ? JSON.parse(existing) : [];
            items.unshift({ ...data, _localId: Date.now() });
            localStorage.setItem(`ecomonitor_${key}`, JSON.stringify(items.slice(0, 1000)));
            return { success: true, local: true };
        } catch (error) { return { success: false, error }; }
    }

    getFromLocalStorage(key, hoursAgo = null) {
        try {
            const data = localStorage.getItem(`ecomonitor_${key}`);
            if (!data) return [];
            let items = JSON.parse(data);
            if (hoursAgo) {
                const since = Date.now() - hoursAgo * 3600000;
                items = items.filter(item => new Date(item.timestamp || item._localId).getTime() > since);
            }
            return items;
        } catch { return []; }
    }
}

export default SupabaseService;
