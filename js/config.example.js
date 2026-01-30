/**
 * EcoMonitor Configuration Template
 * 
 * INSTRUCTIONS:
 * 1. Copy this file and rename to config.js
 * 2. Fill in your actual API keys and credentials
 * 3. NEVER commit config.js to version control
 */

const CONFIG = {
    // Gemini AI API Configuration
    GEMINI: {
        API_KEY: 'your-gemini-api-key-here',
        MODEL: 'gemini-1.5-flash',
        API_URL: 'https://generativelanguage.googleapis.com/v1beta/models'
    },

    // Supabase Configuration
    SUPABASE: {
        URL: 'https://your-project-id.supabase.co',
        ANON_KEY: 'your-supabase-anon-key-here'
    },

    // n8n Webhook Configuration for Email Alerts
    N8N: {
        WEBHOOK_URL: 'https://your-n8n-instance.com/webhook/eco-monitor-alerts',
        ENABLED: true
    },

    // Application Settings
    APP: {
        REFRESH_INTERVAL: 30000,        // Data refresh interval in ms
        ALERT_THRESHOLD_AQI: 150,       // AQI threshold for alerts
        ALERT_THRESHOLD_TEMP: 40,       // Temperature threshold (°C)
        ALERT_THRESHOLD_WATER_PH: 6.5,  // Water pH minimum
        ANOMALY_SENSITIVITY: 0.8,       // AI anomaly detection sensitivity (0-1)
        MAX_HISTORICAL_POINTS: 50       // Max data points for charts
    }
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.GEMINI);
Object.freeze(CONFIG.SUPABASE);
Object.freeze(CONFIG.N8N);
Object.freeze(CONFIG.APP);

export default CONFIG;
