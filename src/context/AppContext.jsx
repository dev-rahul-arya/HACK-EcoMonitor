import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import SensorSimulator from '../modules/sensors';
import GeminiAI from '../modules/gemini';
import AlertService from '../modules/alerts';
import SupabaseService from '../modules/supabase';
import CONFIG from '../modules/config';

const AppContext = createContext(null);

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
}

export function AppProvider({ children }) {
    const sensorsRef = useRef(new SensorSimulator());
    const aiRef = useRef(new GeminiAI());
    const alertsRef = useRef(new AlertService());
    const supabaseRef = useRef(new SupabaseService());

    const [currentData, setCurrentData] = useState(null);
    const [historicalData, setHistoricalData] = useState({ aqi: [], temperature: [], humidity: [], waterPh: [], timestamps: [] });
    const [alertHistory, setAlertHistory] = useState([]);
    const [unreadAlertCount, setUnreadAlertCount] = useState(0);
    const [sensorList, setSensorList] = useState([]);
    const [aiAnalysis, setAiAnalysis] = useState(() => {
        try { const cached = localStorage.getItem('eco_ai_analysis'); return cached ? JSON.parse(cached) : null; } catch { return null; }
    });
    const [aiLoading, setAiLoading] = useState(false);
    const [searchedLocation, setSearchedLocation] = useState(null);
    const [connected, setConnected] = useState(false);
    const [supabaseStatus, setSupabaseStatus] = useState({
        configured: false,
        connected: false,
        auth: false,
        tablesExist: false,
        reason: 'not_checked',
    });
    const [lastSyncTime, setLastSyncTime] = useState('--:--');
    const [isLoading, setIsLoading] = useState(true);
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((type, title, message) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, type, title, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const refreshData = useCallback(async () => {
        try {
            const data = sensorsRef.current.generateSensorData();
            setCurrentData(data);
            setHistoricalData({ ...sensorsRef.current.getHistoricalData() });
            setSensorList([...sensorsRef.current.getSensors()]);

            const anomalies = sensorsRef.current.detectAnomalies(data);
            if (anomalies.length > 0) {
                await alertsRef.current.processAnomalies(anomalies);
            }
            setAlertHistory([...alertsRef.current.getAlertHistory()]);
            setUnreadAlertCount(alertsRef.current.getUnreadCount());

            await supabaseRef.current.saveSensorReading(data);
            setLastSyncTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        } catch (error) {
            console.error('Data refresh error:', error);
        }
    }, []);

    const refreshAIAnalysis = useCallback(async () => {
        setAiLoading(true);
        try {
            const data = currentData || sensorsRef.current.generateSensorData();
            const analysis = await aiRef.current.analyzeEnvironmentalData(data, sensorsRef.current.getHistoricalData());
            setAiAnalysis(analysis);
            try { localStorage.setItem('eco_ai_analysis', JSON.stringify(analysis)); } catch { /* storage full */ }
        } catch (error) {
            console.error('AI analysis error:', error);
        } finally {
            setAiLoading(false);
        }
    }, [currentData]);

    const markAlertRead = useCallback((alertId) => {
        alertsRef.current.markAsRead(alertId);
        setAlertHistory([...alertsRef.current.getAlertHistory()]);
        setUnreadAlertCount(alertsRef.current.getUnreadCount());
    }, []);

    const markAllAlertsRead = useCallback(() => {
        alertsRef.current.markAllAsRead();
        setAlertHistory([...alertsRef.current.getAlertHistory()]);
        setUnreadAlertCount(alertsRef.current.getUnreadCount());
        showToast('success', 'Alerts Updated', 'All alerts marked as read');
    }, [showToast]);

    const exportReport = useCallback(async () => {
        try {
            const data = currentData || sensorsRef.current.generateSensorData();
            let report;
            try {
                report = await aiRef.current.generateReport(data, sensorsRef.current.getHistoricalData(), alertsRef.current.getAlertHistory());
            } catch {
                report = {
                    generatedAt: new Date().toISOString(),
                    currentReadings: data,
                    recentAlerts: alertsRef.current.getAlertHistory().slice(0, 10),
                };
            }
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ecomonitor-report-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('success', 'Report Exported', 'Environmental report has been downloaded');
        } catch { showToast('error', 'Export Failed', 'Unable to generate report'); }
    }, [currentData, showToast]);

    const exportReportCSV = useCallback(() => {
        try {
            const data = currentData || sensorsRef.current.generateSensorData();
            const hist = sensorsRef.current.getHistoricalData();
            const rows = [
                ['Metric', 'Value', 'Unit'],
                ['AQI', data.air.aqi, 'AQI'],
                ['PM2.5', data.air.pm25, 'μg/m³'],
                ['PM10', data.air.pm10, 'μg/m³'],
                ['O3', data.air.o3, 'ppb'],
                ['NO2', data.air.no2, 'ppb'],
                ['SO2', data.air.so2, 'ppb'],
                ['CO', data.air.co, 'ppm'],
                ['Temperature', data.weather.temperature, '°C'],
                ['Humidity', data.weather.humidity, '%'],
                ['Wind Speed', data.weather.windSpeed, 'km/h'],
                ['Pressure', data.weather.pressure, 'hPa'],
                ['UV Index', data.weather.uvIndex, ''],
                ['Condition', data.weather.condition, ''],
                ['Water pH', data.water.ph, 'pH'],
                ['Dissolved Oxygen', data.water.dissolvedOxygen, 'mg/L'],
                ['Turbidity', data.water.turbidity, 'NTU'],
                ['TDS', data.water.tds, 'ppm'],
                ['Water Temperature', data.water.temperature, '°C'],
                ['Conductivity', data.water.conductivity, 'μS/cm'],
            ];
            // Add historical data section
            if (hist.timestamps?.length > 0) {
                rows.push([]);
                rows.push(['Timestamp', 'AQI', 'Temperature (°C)', 'Humidity (%)', 'Water pH']);
                hist.timestamps.forEach((ts, i) => {
                    rows.push([
                        ts instanceof Date ? ts.toISOString() : ts,
                        hist.aqi?.[i] ?? '',
                        hist.temperature?.[i] ?? '',
                        hist.humidity?.[i] ?? '',
                        hist.waterPh?.[i] ?? '',
                    ]);
                });
            }
            const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ecomonitor-report-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('success', 'CSV Exported', 'Environmental data has been downloaded as CSV');
        } catch { showToast('error', 'Export Failed', 'Unable to generate CSV report'); }
    }, [currentData, showToast]);

    const exportAlerts = useCallback(() => {
        const csv = alertsRef.current.exportToCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ecomonitor-alerts-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('success', 'Alerts Exported', 'Alert history has been downloaded');
    }, [showToast]);

    const sendEmergencyAlert = useCallback(async (emergencyData) => {
        try {
            await alertsRef.current.sendEmergencyAlert(emergencyData);
            showToast('warning', 'Emergency Protocol', 'Emergency notifications have been sent');
        } catch { showToast('error', 'Error', 'Failed to activate emergency protocol'); }
    }, [showToast]);

    const saveSettings = useCallback(async (settings) => {
        await supabaseRef.current.saveUserSettings(settings);
        showToast('success', 'Settings Saved', 'Your alert settings have been updated');
    }, [showToast]);

    const loadSettings = useCallback(async () => {
        return await supabaseRef.current.getUserSettings();
    }, []);

    const refreshSupabaseStatus = useCallback(async () => {
        try {
            const configured = supabaseRef.current.isConfigured;
            if (!configured) {
                setSupabaseStatus({
                    configured: false,
                    connected: false,
                    auth: false,
                    tablesExist: false,
                    reason: 'not_configured',
                });
                return;
            }

            const conn = await supabaseRef.current.checkConnection();
            setSupabaseStatus({
                configured: true,
                connected: Boolean(conn.connected),
                auth: Boolean(conn.auth),
                tablesExist: Boolean(conn.tablesExist),
                reason: conn.reason || null,
            });
        } catch {
            setSupabaseStatus({
                configured: true,
                connected: false,
                auth: false,
                tablesExist: false,
                reason: 'check_failed',
            });
        }
    }, []);

    const searchLocation = useCallback(async (query) => {
        if (!query) { showToast('warning', 'Search', 'Please enter a location to search'); return null; }
        showToast('info', 'Searching...', `Looking up "${query}"`);
        try {
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`;
            const geoResponse = await fetch(geoUrl);
            const geoData = await geoResponse.json();
            if (!geoData.results || geoData.results.length === 0) { showToast('error', 'Not Found', `Location "${query}" not found.`); return null; }
            const location = geoData.results[0];
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,uv_index&timezone=auto`;
            const weatherResponse = await fetch(weatherUrl);
            const weatherData = await weatherResponse.json();
            if (weatherData.current) {
                // Update currentData with searched location's weather globally
                setCurrentData(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        location: `${location.name}, ${location.country}`,
                        weather: {
                            ...prev.weather,
                            temperature: weatherData.current.temperature_2m,
                            humidity: weatherData.current.relative_humidity_2m,
                            windSpeed: weatherData.current.wind_speed_10m,
                            pressure: weatherData.current.pressure_msl,
                            uvIndex: weatherData.current.uv_index,
                        },
                    };
                });
                setSearchedLocation(`${location.name}, ${location.country}`);
                showToast('success', 'Location Found', `Showing data for ${location.name}, ${location.country}`);
                return { location, weather: weatherData.current };
            }
            return null;
        } catch { showToast('error', 'Search Error', 'Failed to fetch location data.'); return null; }
    }, [showToast]);

    // Initialization
    useEffect(() => {
        let intervalId;
        const init = async () => {
            const supabaseInit = await supabaseRef.current.initialize();
            if (supabaseInit) {
                const conn = await supabaseRef.current.checkConnection();
                setConnected(conn.connected);
                setSupabaseStatus({
                    configured: true,
                    connected: Boolean(conn.connected),
                    auth: Boolean(conn.auth),
                    tablesExist: Boolean(conn.tablesExist),
                    reason: conn.reason || null,
                });
            } else {
                setSupabaseStatus({
                    configured: false,
                    connected: false,
                    auth: false,
                    tablesExist: false,
                    reason: 'not_configured',
                });
            }
            await refreshData();
            setConnected(true);
            setIsLoading(false);
            // AI analysis is user-triggered only (saves Gemini quota)
            intervalId = setInterval(refreshData, CONFIG.APP.REFRESH_INTERVAL);
        };
        init();
        return () => { if (intervalId) clearInterval(intervalId); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const value = {
        currentData, historicalData, alertHistory, unreadAlertCount,
        sensorList, aiAnalysis, aiLoading, connected, supabaseStatus, lastSyncTime, isLoading,
        searchedLocation,
        toasts, showToast, removeToast,
        refreshData, refreshAIAnalysis,
        markAlertRead, markAllAlertsRead,
        exportReport, exportReportCSV, exportAlerts, sendEmergencyAlert,
        saveSettings, loadSettings, searchLocation, refreshSupabaseStatus,
        sensorsRef, alertsRef, aiRef,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
