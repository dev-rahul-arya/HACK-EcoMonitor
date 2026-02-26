# EcoMonitor - Environmental Intelligence Platform

Real-time environmental monitoring dashboard with AI-powered analysis for climate tech and urban environmental safety.

## 🎯 Target Users
- Urban residents concerned about environmental health
- Environmental agencies monitoring pollution
- Climate-vulnerable communities needing early warnings

## ✨ Features

### Core Functionality
- **Real-time Monitoring**: Air Quality (AQI), Temperature, Humidity, Water pH
- **AI Analysis**: Gemini-powered anomaly detection and recommendations (via Python backend)
- **Climate Trends**: Historical climate data analysis with pandas, risk scoring, and 50-year projections
- **Automated Alerts**: Email notifications via n8n webhooks
- **Multi-location Support**: Downtown, Industrial, Residential, Waterfront zones
- **User Authentication**: Secure login/signup with Supabase Auth (Email, Google, GitHub)

### Dashboard Views
- 📊 **Dashboard**: Overview with live stats, charts, and sensor network
- 🌬️ **Air Quality**: Detailed pollutant breakdown (PM2.5, PM10, O₃, NO₂, SO₂, CO) with AI recommendations
- 💧 **Water Quality**: pH, dissolved oxygen, turbidity, TDS monitoring
- ⛅ **Weather**: Temperature, humidity, pressure, UV index, forecasts
- 🔔 **Alerts**: Alert history with filtering and export
- 🤖 **AI Insights**: Trend analysis, anomaly prediction, health advisories, full reports
- 📈 **Climate Trends**: Historical temperature trends, decadal analysis, anomaly detection, AI policy briefs

---

## 🏗️ Architecture

```
┌─────────────────┐         ┌─────────────────────────┐
│   React + Vite  │  REST   │   Flask Backend (Python)│
│   (Frontend)    │ ──────► │   - pandas processing   │
│                 │         │   - Gemini 2.0 Flash    │
│   Port 5173     │         │   - Response caching    │
└─────────────────┘         │   Port 5000             │
                            └─────────────────────────┘
```

- **Frontend** — React 18 SPA. Renders UI, handles auth, calls backend REST endpoints. No direct Gemini access.
- **Backend** — Flask API. Processes data with pandas/numpy, sends compact summaries to Gemini, caches results. API key stays server-side.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **Google Gemini API Key**: [Get it here](https://aistudio.google.com/app/apikey)
- **Supabase Project**: [Create free project](https://supabase.com)
- **n8n Instance** (optional): For email alerts

### 1. Clone & configure

```bash
git clone https://github.com/your-username/HACK-EcoMonitor.git
cd HACK-EcoMonitor
cp .env.example .env
# Edit .env — at minimum set GEMINI_API_KEY and Supabase credentials
```

### 2. Start the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py                   # Runs on http://localhost:5000
```

### 3. Start the frontend

```bash
# In the project root (new terminal)
npm install
npm run dev                     # Runs on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## 🔑 Environment Variables

All config lives in a single `.env` file in the project root.  
Vite reads `VITE_*` vars for the frontend; the backend reads the rest via `python-dotenv`.

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ | Backend | Google Gemini API key (never sent to browser) |
| `GEMINI_MODEL` | | Backend | Model for complex tasks (default: `gemini-2.0-flash`) |
| `GEMINI_MODEL_LITE` | | Backend | Model for simple tasks (default: `gemini-2.0-flash-lite`) |
| `FLASK_ENV` | | Backend | `development` or `production` |
| `FLASK_PORT` | | Backend | Backend port (default: `5000`) |
| `CACHE_TTL` | | Backend | AI response cache in seconds (default: `1800`) |
| `CLIMATE_CACHE_TTL` | | Backend | Climate brief cache in seconds (default: `86400`) |
| `MAX_GEMINI_RPM` | | Backend | Max Gemini requests/minute (default: `10`) |
| `VITE_BACKEND_URL` | ✅ | Frontend | Backend URL (default: `http://localhost:5000`) |
| `VITE_SUPABASE_URL` | ✅ | Frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Frontend | Supabase anon/public key |
| `VITE_N8N_WEBHOOK_URL` | | Frontend | n8n webhook URL for email alerts |
| `VITE_N8N_ENABLED` | | Frontend | Enable n8n alerts (`true`/`false`) |
| `VITE_REFRESH_INTERVAL` | | Frontend | Data refresh interval in ms (default: `30000`) |

> **Note:** `.env` is git-ignored. The template is in [.env.example](.env.example).

---

## 🐍 Backend API Endpoints

All AI calls are routed through the Flask backend. The frontend never contacts Gemini directly.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Health check (model info, key status) |
| `POST` | `/api/ai/analyze-environment` | Environmental analysis from sensor data |
| `POST` | `/api/ai/generate-report` | Full environmental intelligence report |
| `POST` | `/api/ai/analyze-trends` | Sensor trend analysis with forecasts |
| `POST` | `/api/ai/predict-anomalies` | Anomaly detection + 6-12h predictions |
| `POST` | `/api/ai/health-recommendations` | Health & safety advisories |
| `POST` | `/api/ai/climate-policy-brief` | AI policy brief from pandas-computed climate stats |
| `POST` | `/api/ai/air-quality-recommendations` | AQI-based health recommendations |
| `GET` | `/api/climate/data` | Pre-processed climate analytics (pandas, no AI) |

All AI endpoints include:
- **Server-side data processing** — pandas/numpy crunch the numbers, only compact summaries (~90% token reduction) go to Gemini
- **Response caching** — repeated requests served from cache (30 min default, 24h for static climate data)
- **Offline fallbacks** — every endpoint returns sensible results even if Gemini is unavailable
- **Rate limiting** — built-in per-minute rate limiter prevents 429 errors on free-tier keys
- **Auto-retry** — 429/RESOURCE_EXHAUSTED errors are retried with exponential backoff (3 attempts)
- **Dual-model routing** — complex tasks use `gemini-2.0-flash`, simple ones use `gemini-2.0-flash-lite`

---

## ▲ Deploy to Vercel

### Frontend
1. Push your repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import your repository.
3. Set **Framework Preset** to **Vite**.
4. Add `VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in **Settings → Environment Variables**.
5. Deploy.

### Backend
Deploy the `backend/` directory to any Python hosting (Railway, Render, Fly.io, etc.) and set `GEMINI_API_KEY` in its environment. Point `VITE_BACKEND_URL` to the deployed URL.

---

## 📋 Development Checklist

### ✅ Completed
- [x] React 18 + Vite SPA with routing
- [x] Navy + Green dashboard theme with responsive CSS
- [x] Sensor simulation module with anomaly detection
- [x] Python Flask backend for all Gemini AI calls
- [x] pandas/numpy data processing (climate analytics, anomaly detection)
- [x] AI response caching (configurable TTL)
- [x] Gemini API key secured server-side (never in browser)
- [x] AI Insights: trend analysis, anomaly prediction, health advisories, full reports
- [x] Climate Trends: historical temperature analysis, risk index, 50-year projections, AI policy briefs
- [x] Air Quality view with AI recommendations
- [x] n8n webhook alerts module
- [x] Supabase auth + persistence module
- [x] Environment variables for deployment
- [x] .gitignore to protect credentials

### 🔲 Next Steps
- [ ] Connect Supabase — create tables and test persistence
- [ ] Setup n8n workflow — email alert automation
- [ ] Mobile responsiveness testing
- [ ] Rate limiting for API calls
- [ ] Input validation/sanitization

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
├── .env.example            # All environment variables (frontend + backend)
├── index.html              # HTML entry point
├── vite.config.js          # Vite configuration
├── backend/                # Python Flask API
│   ├── app.py              # Flask server — all AI endpoints, pandas processing, caching
│   └── requirements.txt    # Python dependencies
├── public/                 # Static assets
│   └── data/               # Climate CSV data
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
│   │   ├── AppContext.jsx  # Sensor data, alerts, AI state
│   │   └── AuthContext.jsx # Supabase auth state
│   ├── layouts/
│   │   └── DashboardLayout.jsx
│   ├── modules/            # Service classes
│   │   ├── config.js       # Reads VITE_* env vars
│   │   ├── sensors.js      # IoT sensor simulation
│   │   ├── gemini.js       # Thin REST client → backend API (no direct Gemini)
│   │   ├── climateData.js  # Climate CSV parsing & analytics
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
│   │   ├── AIInsightsView.jsx
│   │   └── ClimateTrendsView.jsx
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
