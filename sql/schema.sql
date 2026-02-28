-- ============================================
-- EcoMonitor Database Schema
-- Supabase PostgreSQL Database
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. User Profiles Table
-- Stores additional user information beyond Supabase Auth
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(200),
    avatar_url TEXT,
    preferred_location JSONB DEFAULT NULL,
    notification_preferences JSONB DEFAULT '{"email": true, "push": false}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Function to create profile on user signup
-- NOTE: SET search_path = public is REQUIRED for SECURITY DEFINER
-- functions in Supabase, otherwise the function can't find tables.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name  = EXCLUDED.last_name,
        full_name  = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = now();
    RETURN NEW;
END;
$$;

-- Trigger to auto-create profile
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 2. Sensor Readings Table
-- Stores environmental sensor data
-- ============================================
CREATE TABLE IF NOT EXISTS sensor_readings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Location data
    location_name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Environmental readings
    temperature DECIMAL(5, 2),           -- in Celsius
    humidity DECIMAL(5, 2),              -- percentage
    air_quality_index INTEGER,           -- AQI value
    pm25 DECIMAL(6, 2),                  -- PM2.5 in µg/m³
    pm10 DECIMAL(6, 2),                  -- PM10 in µg/m³
    co2 DECIMAL(8, 2),                   -- CO2 in ppm
    noise_level DECIMAL(5, 2),           -- in decibels
    uv_index DECIMAL(4, 2),              -- UV Index
    
    -- Metadata
    source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'api', 'sensor'
    raw_data JSONB,                      -- Store any additional raw data
    
    -- Timestamps
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_sensor_readings_user_id ON sensor_readings(user_id);
CREATE INDEX idx_sensor_readings_location ON sensor_readings(location_name);
CREATE INDEX idx_sensor_readings_recorded_at ON sensor_readings(recorded_at DESC);

-- Enable RLS
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;

-- Sensor readings policies
CREATE POLICY "Users can view their own sensor readings"
    ON sensor_readings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sensor readings"
    ON sensor_readings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sensor readings"
    ON sensor_readings FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 3. Alerts Table
-- Stores environmental alerts and notifications
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Alert details
    alert_type VARCHAR(50) NOT NULL,       -- 'air_quality', 'temperature', 'humidity', 'uv', 'noise'
    severity VARCHAR(20) NOT NULL,          -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Location data
    location_name VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Alert values
    current_value DECIMAL(10, 2),
    threshold_value DECIMAL(10, 2),
    unit VARCHAR(20),
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'active',   -- 'active', 'acknowledged', 'resolved'
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    -- Actions
    action_taken TEXT,
    action_webhook_sent BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at DESC);

-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Alerts policies
CREATE POLICY "Users can view their own alerts"
    ON alerts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alerts"
    ON alerts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
    ON alerts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts"
    ON alerts FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 4. AI Reports Table
-- Stores AI-generated environmental analysis
-- ============================================
CREATE TABLE IF NOT EXISTS ai_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Report details
    report_type VARCHAR(50) NOT NULL,      -- 'analysis', 'prediction', 'recommendation'
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    full_report TEXT NOT NULL,
    
    -- Input data
    input_data JSONB,                       -- The data sent to AI
    
    -- Location context
    location_name VARCHAR(255),
    
    -- AI metadata
    ai_model VARCHAR(100),                  -- e.g., 'gemini-2.5-flash'
    tokens_used INTEGER,
    generation_time_ms INTEGER,
    
    -- Timestamps
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ai_reports_user_id ON ai_reports(user_id);
CREATE INDEX idx_ai_reports_type ON ai_reports(report_type);
CREATE INDEX idx_ai_reports_generated_at ON ai_reports(generated_at DESC);

-- Enable RLS
ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;

-- AI reports policies
CREATE POLICY "Users can view their own AI reports"
    ON ai_reports FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI reports"
    ON ai_reports FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI reports"
    ON ai_reports FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 5. User Settings Table
-- Stores user preferences and thresholds
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Alert thresholds
    thresholds JSONB DEFAULT '{
        "air_quality": {"warning": 100, "critical": 150},
        "temperature": {"low": 5, "high": 35},
        "humidity": {"low": 30, "high": 70},
        "uv_index": {"warning": 6, "critical": 8},
        "noise_level": {"warning": 70, "critical": 85}
    }'::jsonb,
    
    -- Dashboard preferences
    dashboard_layout JSONB DEFAULT '{
        "showWeather": true,
        "showAirQuality": true,
        "showAlerts": true,
        "chartTimeRange": "24h"
    }'::jsonb,
    
    -- Notification settings
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT FALSE,
    alert_frequency VARCHAR(20) DEFAULT 'immediate', -- 'immediate', 'hourly', 'daily'
    
    -- Theme preference
    theme VARCHAR(20) DEFAULT 'dark',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- User settings policies
CREATE POLICY "Users can view their own settings"
    ON user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
    ON user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
    ON user_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to create default settings on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_settings (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Trigger to auto-create settings
CREATE OR REPLACE TRIGGER on_auth_user_created_settings
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_settings();

-- ============================================
-- 6. Saved Locations Table
-- Stores user's favorite locations
-- ============================================
CREATE TABLE IF NOT EXISTS saved_locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Location details
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    country VARCHAR(100),
    region VARCHAR(100),
    
    -- Preferences
    is_primary BOOLEAN DEFAULT FALSE,
    notify_alerts BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_saved_locations_user_id ON saved_locations(user_id);
CREATE INDEX idx_saved_locations_coords ON saved_locations(latitude, longitude);

-- Enable RLS
ALTER TABLE saved_locations ENABLE ROW LEVEL SECURITY;

-- Saved locations policies
CREATE POLICY "Users can view their own saved locations"
    ON saved_locations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved locations"
    ON saved_locations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved locations"
    ON saved_locations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved locations"
    ON saved_locations FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 7. Activity Log Table
-- Tracks user actions for audit
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Action details
    action_type VARCHAR(50) NOT NULL,      -- 'login', 'alert_acknowledged', 'settings_updated', etc.
    action_description TEXT,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_action_type ON activity_log(action_type);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Activity log policies
CREATE POLICY "Users can view their own activity log"
    ON activity_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity log"
    ON activity_log FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Update timestamp function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Helpful Views
-- ============================================

-- View: Recent alerts summary
CREATE OR REPLACE VIEW recent_alerts_summary AS
SELECT 
    user_id,
    COUNT(*) FILTER (WHERE status = 'active') AS active_alerts,
    COUNT(*) FILTER (WHERE status = 'acknowledged') AS acknowledged_alerts,
    COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'active') AS critical_alerts,
    MAX(triggered_at) AS last_alert_time
FROM alerts
WHERE triggered_at > NOW() - INTERVAL '7 days'
GROUP BY user_id;

-- View: Daily sensor averages
CREATE OR REPLACE VIEW daily_sensor_averages AS
SELECT 
    user_id,
    location_name,
    DATE(recorded_at) AS reading_date,
    AVG(temperature) AS avg_temperature,
    AVG(humidity) AS avg_humidity,
    AVG(air_quality_index) AS avg_aqi,
    AVG(pm25) AS avg_pm25,
    COUNT(*) AS reading_count
FROM sensor_readings
GROUP BY user_id, location_name, DATE(recorded_at);

-- ============================================
-- Sample Data (Optional - for testing)
-- ============================================

-- Uncomment below to insert sample data for testing
/*
-- Insert sample sensor readings (replace 'YOUR_USER_ID' with actual user ID)
INSERT INTO sensor_readings (user_id, location_name, latitude, longitude, temperature, humidity, air_quality_index, pm25, pm10, uv_index, noise_level)
VALUES 
    ('YOUR_USER_ID', 'Delhi, India', 28.6139, 77.2090, 32.5, 65, 156, 78.5, 124.3, 7.2, 68),
    ('YOUR_USER_ID', 'Delhi, India', 28.6139, 77.2090, 31.8, 68, 142, 72.1, 118.5, 6.8, 72),
    ('YOUR_USER_ID', 'Delhi, India', 28.6139, 77.2090, 30.2, 72, 138, 68.4, 112.8, 5.5, 65);

-- Insert sample alert
INSERT INTO alerts (user_id, alert_type, severity, title, description, location_name, current_value, threshold_value, unit)
VALUES 
    ('YOUR_USER_ID', 'air_quality', 'high', 'Poor Air Quality Detected', 'AQI has exceeded safe levels in your area', 'Delhi, India', 156, 100, 'AQI');
*/

-- ============================================
-- End of Schema
-- ============================================
