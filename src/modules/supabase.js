/**
 * EcoMonitor - Supabase Integration Module
 *
 * Uses the **shared singleton** client from supabaseClient.js.
 * This is critical because Supabase RLS policies evaluate auth.uid()
 * from the JWT attached to the request.  If this service had its own
 * createClient() the JWT would be missing → every query returns 0 rows.
 */

import { supabase, hasSupabaseConfig } from './supabaseClient';

class SupabaseService {
    constructor() {
        /** True when env vars are present. */
        this.isConfigured = hasSupabaseConfig;
        this.subscriptions = [];
    }

    /** Expose the shared singleton so callers can still do this.client.* */
    get client() {
        return supabase;
    }

    /**
     * No-op initializer kept for backward compatibility with AppContext.
     * The real client is created at import-time in supabaseClient.js.
     */
    async initialize() {
        if (!this.isConfigured) {
            console.log('Supabase not configured, using local storage fallback');
            return false;
        }
        return true;
    }

    async _getCurrentUserId() {
        const client = await this.getSupabaseClient();
        if (!client) return null;
        const { data, error } = await client.auth.getUser();
        if (error || !data?.user?.id) return null;
        return data.user.id;
    }

    _toNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    async saveSensorReading(reading) {
        if (!this.client) return this.saveToLocalStorage('sensor_readings', reading);
        try {
            const userId = await this._getCurrentUserId();
            if (!userId) return this.saveToLocalStorage('sensor_readings', reading);

            const payload = {
                user_id: userId,
                location_name: reading.location || 'default',
                temperature: this._toNumber(reading?.weather?.temperature),
                humidity: this._toNumber(reading?.weather?.humidity),
                air_quality_index: this._toNumber(reading?.air?.aqi),
                pm25: this._toNumber(reading?.air?.pm25),
                pm10: this._toNumber(reading?.air?.pm10),
                co2: this._toNumber(reading?.air?.co2),
                uv_index: this._toNumber(reading?.weather?.uvIndex),
                source: 'sensor',
                raw_data: {
                    air: reading?.air || {},
                    weather: reading?.weather || {},
                    water: reading?.water || {},
                    timestamp: reading?.timestamp || new Date().toISOString(),
                },
                recorded_at: reading?.timestamp || new Date().toISOString(),
            };

            const { data, error } = await this.client.from('sensor_readings').insert([payload]);
            if (error) throw error;
            return { success: true, data };
        } catch { return this.saveToLocalStorage('sensor_readings', reading); }
    }

    async getRecentReadings(hours = 24, location = null) {
        if (!this.client) return this.getFromLocalStorage('sensor_readings', hours);
        try {
            const since = new Date(Date.now() - hours * 3600000).toISOString();
            let query = this.client.from('sensor_readings').select('*').gte('recorded_at', since).order('recorded_at', { ascending: false });
            if (location) query = query.eq('location_name', location);
            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch { return this.getFromLocalStorage('sensor_readings', hours); }
    }

    async saveAlert(alert) {
        if (!this.client) return this.saveToLocalStorage('alerts', alert);
        try {
            const userId = await this._getCurrentUserId();
            if (!userId) return this.saveToLocalStorage('alerts', alert);

            const { data, error } = await this.client.from('alerts').insert([{
                user_id: userId,
                alert_type: alert.type || 'environment',
                severity: alert.severity || 'medium',
                title: alert.title || 'Environmental Alert',
                description: alert.message || '',
                location_name: alert.location || 'default',
                current_value: this._toNumber(alert.value),
                threshold_value: this._toNumber(alert.threshold),
                unit: alert.unit || null,
                status: alert.read ? 'acknowledged' : 'active',
                triggered_at: alert.timestamp || new Date().toISOString(),
            }]);
            if (error) throw error;
            return { success: true, data };
        } catch { return this.saveToLocalStorage('alerts', alert); }
    }

    async saveUserSettings(settings) {
        if (!this.client) { localStorage.setItem('ecomonitor_settings', JSON.stringify(settings)); return { success: true }; }
        try {
            const userId = await this._getCurrentUserId();
            if (!userId) { localStorage.setItem('ecomonitor_settings', JSON.stringify(settings)); return { success: true, local: true }; }

            const payload = {
                user_id: userId,
                thresholds: {
                    air_quality: { warning: this._toNumber(settings?.aqiThreshold) ?? 100, critical: 150 },
                    temperature: { low: 5, high: this._toNumber(settings?.tempThreshold) ?? 35 },
                },
                email_notifications: Boolean(settings?.instantAlerts),
                alert_frequency: settings?.instantAlerts ? 'immediate' : 'daily',
                updated_at: new Date().toISOString(),
            };

            const { data, error } = await this.client.from('user_settings').upsert([payload], { onConflict: 'user_id' });
            if (error) throw error;
            return { success: true, data };
        } catch { localStorage.setItem('ecomonitor_settings', JSON.stringify(settings)); return { success: true }; }
    }

    async getUserSettings() {
        if (!this.client) { const s = localStorage.getItem('ecomonitor_settings'); return s ? JSON.parse(s) : null; }
        try {
            const userId = await this._getCurrentUserId();
            if (!userId) {
                const s = localStorage.getItem('ecomonitor_settings');
                return s ? JSON.parse(s) : null;
            }

            const { data, error } = await this.client.from('user_settings').select('*').eq('user_id', userId).single();
            if (error && error.code !== 'PGRST116') throw error;

            if (!data) return null;
            return {
                email: '',
                aqiThreshold: data?.thresholds?.air_quality?.warning ?? 100,
                tempThreshold: data?.thresholds?.temperature?.high ?? 35,
                instantAlerts: Boolean(data?.email_notifications),
            };
        } catch { const s = localStorage.getItem('ecomonitor_settings'); return s ? JSON.parse(s) : null; }
    }

    async checkConnection() {
        if (!this.client) return { connected: false, reason: 'not_configured' };
        try {
            const { data: authData, error: authError } = await this.client.auth.getSession();
            const hasSession = Boolean(authData?.session);
            if (authError) return { connected: false, auth: false, error: authError };

            const { data, error } = await this.client.from('sensor_readings').select('id').limit(1);
            if (error) {
                if (error.code === '42P01') return { connected: true, tablesExist: false };
                return { connected: false, auth: hasSession, error };
            }
            return { connected: true, auth: hasSession, tablesExist: true, recordCount: data?.length || 0 };
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
