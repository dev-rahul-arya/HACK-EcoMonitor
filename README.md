# EcoMonitor - Intelligent Environmental Monitoring

EcoMonitor is a real-time environmental monitoring dashboard that leverages AI (Google Gemini) to detect anomalies in sensor data and automate responses via n8n integration.

## Features
- **Real-time Monitoring**: Visualizes Air Quality (AQI), Temperature, and Water pH from IoT sensors.
- **AI Analysis**: Uses Gemini Pro to analyze data points in real-time, providing status assessments and actionable recommendations.
- **Automated Alerts**: Sends critical alerts to an n8n webhook (which can trigger emails/SMS).
- **Simulation Mode**: Generates realistic dummy sensor data with random anomaly injection for demonstration.

## Setup & Running

This project uses Vanilla JavaScript with ES Modules.

### Prerequisites
1. **Google Gemini API Key**: [Get it here](https://aistudio.google.com/app/apikey)
2. **n8n Workflow (Optional)**: Set up a webhook in n8n to receive POST requests for alerts.

### How to Run
Due to ES Module security policies in browsers (`CORS`), you cannot open `index.html` directly from the file system. You need a local web server.

#### Option 1: VS Code Live Server (Recommended)
1. Install the "Live Server" extension in VS Code.
2. Right-click `index.html` and select "Open with Live Server".

#### Option 2: Python HTTP Server
Run this command in the project root:
```bash
python3 -m http.server
```
Then open `http://localhost:8000` in your browser.

## Usage
1. Open the web app.
2. Enter your **Gemini API Key** in the configuration modal.
3. (Optional) Enter your **n8n Webhook URL**.
4. Click **Start Simulation**.
5. Watch as the sensors update and the AI analyzes the data streams.
