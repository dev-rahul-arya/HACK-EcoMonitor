# EcoMonitor - Environmental Intelligence Platform

Real-time environmental monitoring dashboard with AI-powered analysis for climate tech and urban environmental safety.

## 🎯 Target Users
- Urban residents concerned about environmental health
- Environmental agencies monitoring pollution
- Climate-vulnerable communities needing early warnings

## ✨ Features

### Core Functionality
- **Real-time Monitoring**: Air Quality (AQI), Temperature, Humidity, Water pH
- **AI Analysis**: Gemini-powered anomaly detection and recommendations
- **Automated Alerts**: Email notifications via n8n webhooks
- **Multi-location Support**: Downtown, Industrial, Residential, Waterfront zones

### Dashboard Views
- 📊 **Dashboard**: Overview with live stats, charts, and sensor network
- 🌬️ **Air Quality**: Detailed pollutant breakdown (PM2.5, PM10, O₃, NO₂, SO₂, CO)
- 💧 **Water Quality**: pH, dissolved oxygen, turbidity, TDS monitoring
- ⛅ **Weather**: Temperature, humidity, pressure, UV index, forecasts
- 🔔 **Alerts**: Alert history with filtering and export
- 🤖 **AI Insights**: Comprehensive environmental intelligence reports

---

## 🚀 Quick Start

### Prerequisites
1. **Google Gemini API Key**: [Get it here](https://aistudio.google.com/app/apikey)
2. **Supabase Project** (optional): [Create free project](https://supabase.com)
3. **n8n Instance** (optional): For email alerts

### Setup
1. Copy `js/config.example.js` to `js/config.js`
2. Add your API credentials to `config.js`
3. Start a local server (see below)

### Running Locally

**Option 1: VS Code Live Server (Recommended)**
```bash
# Install Live Server extension, then right-click index.html → Open with Live Server
```

**Option 2: Python HTTP Server**
```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

**Option 3: Node.js**
```bash
npx serve .
```

---

## 📋 Development Checklist

### ✅ Completed
- [x] Project structure and configuration
- [x] .gitignore to protect credentials
- [x] HTML dashboard with all views
- [x] CSS styling (Navy + Green theme)
- [x] Sensor simulation module
- [x] Gemini AI integration module
- [x] n8n alerts module
- [x] Supabase persistence module
- [x] Main app.js controller

### 🔲 Next Steps
- [ ] **Test full application flow** - Open in browser and verify
- [ ] **Connect Supabase** - Create tables and test persistence
- [ ] **Setup n8n workflow** - Email alert automation
- [ ] **Add Gemini API key** - Test AI analysis
- [ ] **Mobile responsiveness** - Test on various screens
- [ ] **Add loading states** - Better UX during data fetch
- [ ] **Error handling improvements** - User-friendly error messages
- [ ] **Data export feature** - CSV/PDF report generation
- [ ] **Historical data charts** - Longer time range analysis
- [ ] **Threshold customization** - User-configurable alert limits

### 🎨 UI Enhancements (Optional)
- [ ] Add map visualization for sensor locations
- [ ] Implement dark/light theme toggle
- [ ] Add notification sound for critical alerts
- [ ] Animate stat card updates
- [ ] Add sparkline mini-charts in stat cards

### 🔒 Security & Production
- [ ] Environment variables for deployment
- [ ] Rate limiting for API calls
- [ ] Input validation/sanitization
- [ ] HTTPS enforcement
- [ ] Content Security Policy headers

---

## 🗄️ Supabase Schema

Create these tables in your Supabase project:

```sql
-- Sensor readings table
CREATE TABLE sensor_readings (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    location TEXT,
    air_data JSONB,
    weather_data JSONB,
    water_data JSONB
);

-- Alerts table
CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_id TEXT UNIQUE,
    type TEXT,
    severity TEXT,
    message TEXT,
    value NUMERIC,
    threshold TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    read BOOLEAN DEFAULT FALSE,
    location TEXT
);

-- User settings table
CREATE TABLE user_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    alert_email TEXT,
    aqi_threshold INTEGER DEFAULT 150,
    temp_threshold INTEGER DEFAULT 40,
    instant_alerts BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI reports table
CREATE TABLE ai_reports (
    id BIGSERIAL PRIMARY KEY,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    summary TEXT,
    concerns JSONB,
    recommendations JSONB,
    prediction TEXT,
    sensor_snapshot JSONB,
    data_quality JSONB
);
```

---

## 🔗 n8n Webhook Setup

1. Create new workflow in n8n
2. Add **Webhook** trigger node
3. Add **Send Email** node (configure SMTP)
4. Connect and activate workflow
5. Copy webhook URL to `config.js`

---

## 📁 Project Structure

```
EcoMonitor/
├── index.html              # Main HTML
├── css/
│   └── style.css           # All styles
├── js/
│   ├── app.js              # Main controller
│   ├── config.js           # Credentials (gitignored)
│   ├── config.example.js   # Template
│   └── modules/
│       ├── sensors.js      # IoT simulation
│       ├── gemini.js       # AI analysis
│       ├── alerts.js       # n8n integration
│       └── supabase.js     # Database
└── README.md
```

---

## 📄 License

MIT License - Feel free to use for hackathons and projects!
