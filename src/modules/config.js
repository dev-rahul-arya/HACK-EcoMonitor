/**
 * EcoMonitor Configuration
 * 
 * Reads from environment variables (Vite exposes VITE_* vars via import.meta.env).
 * For local development, create a .env file in the project root.
 * For Vercel deployment, add these in Project Settings → Environment Variables.
 */

const CONFIG = {
    // Backend API (Node.js Express — handles all Gemini calls server-side)
    BACKEND: {
        API_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000',
    },

    // Supabase Configuration
    SUPABASE: {
        URL: import.meta.env.VITE_SUPABASE_URL || '',
        ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    },

    // n8n Webhook Configuration for Email Alerts
    N8N: {
        WEBHOOK_URL: import.meta.env.VITE_N8N_WEBHOOK_URL || '',
        ENABLED: import.meta.env.VITE_N8N_ENABLED !== 'false'
    },

    // Application Settings
    APP: {
        REFRESH_INTERVAL: parseInt(import.meta.env.VITE_REFRESH_INTERVAL || '30000', 10),
        ALERT_THRESHOLD_AQI: parseInt(import.meta.env.VITE_ALERT_THRESHOLD_AQI || '150', 10),
        ALERT_THRESHOLD_TEMP: parseInt(import.meta.env.VITE_ALERT_THRESHOLD_TEMP || '40', 10),
        ALERT_THRESHOLD_WATER_PH: parseFloat(import.meta.env.VITE_ALERT_THRESHOLD_WATER_PH || '6.5'),
        ANOMALY_SENSITIVITY: parseFloat(import.meta.env.VITE_ANOMALY_SENSITIVITY || '0.8'),
        MAX_HISTORICAL_POINTS: parseInt(import.meta.env.VITE_MAX_HISTORICAL_POINTS || '50', 10)
    }
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.BACKEND);
Object.freeze(CONFIG.SUPABASE);
Object.freeze(CONFIG.N8N);
Object.freeze(CONFIG.APP);

export default CONFIG;
