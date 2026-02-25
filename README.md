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
- **User Authentication**: Secure login/signup with Supabase Auth (Email, Google, GitHub)

### Dashboard Views
- 📊 **Dashboard**: Overview with live stats, charts, and sensor network
- 🌬️ **Air Quality**: Detailed pollutant breakdown (PM2.5, PM10, O₃, NO₂, SO₂, CO)
- 💧 **Water Quality**: pH, dissolved oxygen, turbidity, TDS monitoring
- ⛅ **Weather**: Temperature, humidity, pressure, UV index, forecasts
- 🔔 **Alerts**: Alert history with filtering and export
- 🤖 **AI Insights**: Comprehensive environmental intelligence reports

### Pages
- 🏠 **Landing Page** (`home.html`): Marketing page with features overview
- 🔐 **Login** (`login.html`): User authentication with social login
- 📝 **Sign Up** (`signup.html`): User registration with email verification
- 📊 **Dashboard** (`index.html`): Main monitoring dashboard

---

## 🚀 Quick Start

### Prerequisites
1. **Node.js** ≥ 18
2. **Google Gemini API Key**: [Get it here](https://aistudio.google.com/app/apikey)
3. **Supabase Project**: [Create free project](https://supabase.com)
4. **n8n Instance** (optional): For email alerts

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-username/HACK-EcoMonitor.git
cd HACK-EcoMonitor

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env

# 4. Open .env and fill in your API keys (see Environment Variables section below)

# 5. Start the dev server
npm run dev
```

---

## 🔑 Environment Variables

The app reads configuration from environment variables prefixed with `VITE_`.  
For **local development**, create a `.env` file in the project root.  
For **Vercel / production**, add them in your hosting dashboard.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `VITE_GEMINI_MODEL` | | Model name (default: `gemini-2.5-flash`) |
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `VITE_N8N_WEBHOOK_URL` | | n8n webhook URL for email alerts |
| `VITE_N8N_ENABLED` | | Enable n8n alerts (`true`/`false`, default: `true`) |
| `VITE_REFRESH_INTERVAL` | | Data refresh interval in ms (default: `30000`) |
| `VITE_ALERT_THRESHOLD_AQI` | | AQI alert threshold (default: `150`) |
| `VITE_ALERT_THRESHOLD_TEMP` | | Temperature alert threshold °C (default: `40`) |
| `VITE_ALERT_THRESHOLD_WATER_PH` | | Minimum safe water pH (default: `6.5`) |
| `VITE_ANOMALY_SENSITIVITY` | | AI anomaly sensitivity 0-1 (default: `0.8`) |
| `VITE_MAX_HISTORICAL_POINTS` | | Max chart data points (default: `50`) |

> **Note:** `.env` is git-ignored. The template is in [.env.example](.env.example).

---

## ▲ Deploy to Vercel

1. Push your repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import your repository.
3. In **Settings → Environment Variables**, add the required `VITE_*` variables listed above.
4. Set the **Framework Preset** to **Vite**.
5. Deploy — Vercel will run `npm run build` automatically.

> Every push to `main` will trigger a new deployment. Preview deployments are created for PRs.

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
- [x] Environment variables for deployment
- [ ] Rate limiting for API calls
- [ ] Input validation/sanitization
- [ ] HTTPS enforcement
- [ ] Content Security Policy headers

---

## 🗄️ Database Setup (Supabase)

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned (~2 minutes)
3. Go to **Project Settings** → **API** and copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon public key**

### Step 2: Add Credentials to `.env`
Add these to your `.env` file (or Vercel env vars):
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 3: Run SQL Schema
1. Go to **SQL Editor** in your Supabase dashboard
2. Open [sql/schema.sql](sql/schema.sql)
3. Copy the entire contents and paste into the SQL Editor
4. Click **Run** to execute all statements

The schema creates the following tables:
| Table | Purpose |
|-------|---------|
| `profiles` | User profile data (auto-created on signup) |
| `sensor_readings` | Environmental sensor data |
| `alerts` | Alert notifications and status |
| `ai_reports` | AI-generated analysis reports |
| `user_settings` | User preferences and thresholds |
| `saved_locations` | User's favorite locations |
| `activity_log` | Audit trail of user actions |

### Step 4: Configure Authentication

#### Enable Email Auth
1. Go to **Authentication** → **Providers**
2. Email provider should be enabled by default
3. Configure **Site URL** to your app URL (e.g., `http://localhost:8080`)
4. Add redirect URLs:
   - `http://localhost:8080/index.html`
   - `http://localhost:8080/login.html`

#### Enable Google OAuth (Optional)
1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com)
2. In Supabase: **Authentication** → **Providers** → **Google**
3. Enable and add your Client ID and Secret
4. Add authorized redirect URI from Supabase to Google Console

#### Enable GitHub OAuth (Optional)
1. Create OAuth App in [GitHub Developer Settings](https://github.com/settings/developers)
2. In Supabase: **Authentication** → **Providers** → **GitHub**
3. Enable and add your Client ID and Secret
4. Set callback URL to the one provided by Supabase

---

## 🔗 n8n Webhook Setup

1. Create new workflow in n8n
2. Add **Webhook** trigger node
3. Add **Send Email** node (configure SMTP)
4. Connect and activate workflow
5. Set `VITE_N8N_WEBHOOK_URL` in your `.env` or Vercel env vars

---

## 📁 Project Structure

```
EcoMonitor/
├── index.html              # HTML entry point
├── .env.example            # Environment variables template
├── vite.config.js          # Vite configuration
├── public/                 # Static assets
├── sql/
│   └── schema.sql          # Supabase database schema
├── src/
│   ├── main.jsx            # React entry point
│   ├── App.jsx             # Root component & routing
│   ├── components/         # Shared UI components
│   │   ├── Sidebar.jsx
│   │   ├── TopHeader.jsx
│   │   └── ToastContainer.jsx
│   ├── context/            # React Context providers
│   │   ├── AppContext.jsx
│   │   └── AuthContext.jsx
│   ├── layouts/
│   │   └── DashboardLayout.jsx
│   ├── modules/            # Service classes
│   │   ├── config.js       # Reads VITE_* env vars
│   │   ├── sensors.js      # IoT simulation
│   │   ├── gemini.js       # Gemini AI integration
│   │   ├── alerts.js       # n8n webhook alerts
│   │   └── supabase.js     # Supabase persistence
│   ├── pages/              # Route pages
│   │   ├── HomePage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── SignupPage.jsx
│   │   ├── DashboardView.jsx
│   │   ├── AirQualityView.jsx
│   │   ├── WaterQualityView.jsx
│   │   ├── WeatherView.jsx
│   │   ├── AlertsView.jsx
│   │   └── AIInsightsView.jsx
│   └── styles/             # CSS stylesheets
│       ├── style.css
│       ├── home.css
│       └── auth.css
└── README.md
```

---

## 🔐 Authentication Flow

1. **New users**: Visit `home.html` → Click "Get Started" → `signup.html`
2. **Existing users**: `login.html` → Enter credentials → Redirected to `index.html`
3. **Social login**: Click Google/GitHub → OAuth flow → Redirected to `index.html`

### Session Management
- Sessions are managed by Supabase Auth
- Tokens are stored in localStorage
- Auto-refresh of tokens is handled by Supabase client

---

## 📄 License

MIT License
