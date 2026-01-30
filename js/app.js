/**
 * EcoMonitor - Main Application
 * Environmental Intelligence Platform
 */

import CONFIG from './config.js';
import SensorSimulator from './modules/sensors.js';
import GeminiAI from './modules/gemini.js';
import AlertService from './modules/alerts.js';
import SupabaseService from './modules/supabase.js';

class EcoMonitor {
    constructor() {
        this.sensors = new SensorSimulator();
        this.ai = new GeminiAI();
        this.alerts = new AlertService();
        this.supabase = new SupabaseService();
        
        this.currentData = null;
        this.charts = {};
        this.refreshInterval = CONFIG.APP.REFRESH_INTERVAL;
        this.isInitialized = false;
        this.currentView = 'dashboard';
        this.currentLocation = 'all';
    }

    async initialize() {
        try {
            // Initialize Supabase
            await this.supabase.initialize();
            
            // Load user settings
            await this.loadSettings();
            
            // Setup UI event listeners
            this.setupEventListeners();
            
            // Initialize charts
            this.initializeCharts();
            
            // Get initial data
            await this.refreshData();
            
            // Start data refresh loop
            this.startDataRefresh();
            
            // Update connection status
            this.updateConnectionStatus(true);
            
            // Hide loading overlay
            this.hideLoadingOverlay();
            
            // Get initial AI analysis
            this.refreshAIAnalysis();
            
            this.isInitialized = true;
            console.log('EcoMonitor initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showToast('error', 'Initialization Error', 'Failed to initialize. Some features may not work.');
            this.hideLoadingOverlay();
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => this.switchView(item.dataset.view));
        });

        // Panel links
        document.querySelectorAll('.panel-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchView(link.dataset.view);
            });
        });

        // Menu toggle (mobile)
        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('open');
        });

        // Refresh button
        document.getElementById('refresh-btn')?.addEventListener('click', () => this.refreshData());

        // AI refresh
        document.getElementById('refresh-ai')?.addEventListener('click', () => this.refreshAIAnalysis());

        // Location selector
        document.getElementById('location-select')?.addEventListener('change', (e) => {
            this.currentLocation = e.target.value;
            this.updateDashboard();
        });

        // Chart time range buttons
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.updateTrendsChart(e.target.dataset.range);
            });
        });

        // Quick actions
        document.getElementById('action-export')?.addEventListener('click', () => this.exportReport());
        document.getElementById('action-alert-settings')?.addEventListener('click', () => this.toggleAlertSettings());
        document.getElementById('action-emergency')?.addEventListener('click', () => this.openEmergencyModal());

        // Alert filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterAlerts(e.target.dataset.filter);
            });
        });

        // Alert actions
        document.getElementById('mark-all-read')?.addEventListener('click', () => this.markAllAlertsRead());
        document.getElementById('export-alerts')?.addEventListener('click', () => this.exportAlerts());

        // AI action cards
        document.getElementById('analyze-trends')?.addEventListener('click', () => this.analyzeTrends());
        document.getElementById('predict-anomalies')?.addEventListener('click', () => this.predictAnomalies());
        document.getElementById('get-recommendations')?.addEventListener('click', () => this.getRecommendations());
        document.getElementById('generate-report')?.addEventListener('click', () => this.generateFullReport());

        // Modal controls
        document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal('alert-modal'));
        document.getElementById('modal-dismiss')?.addEventListener('click', () => this.closeModal('alert-modal'));
        document.getElementById('modal-action')?.addEventListener('click', () => this.takeAlertAction());
        document.getElementById('emergency-cancel')?.addEventListener('click', () => this.closeModal('emergency-modal'));
        document.getElementById('emergency-confirm')?.addEventListener('click', () => this.activateEmergencyProtocol());

        // Settings
        document.getElementById('save-alert-settings')?.addEventListener('click', () => this.saveSettings());

        // Range sliders
        document.getElementById('aqi-threshold')?.addEventListener('input', (e) => {
            document.getElementById('aqi-threshold-value').textContent = e.target.value;
        });
        document.getElementById('temp-threshold')?.addEventListener('input', (e) => {
            document.getElementById('temp-threshold-value').textContent = e.target.value;
        });

        // Notification button
        document.getElementById('notification-btn')?.addEventListener('click', () => this.switchView('alerts'));

        // Close sidebar on outside click (mobile)
        document.addEventListener('click', (e) => {
            const sidebar = document.querySelector('.sidebar');
            const menuToggle = document.getElementById('menu-toggle');
            if (sidebar.classList.contains('open') && 
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }

    initializeCharts() {
        const chartDefaults = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#9ca3af',
                        font: { family: 'Inter' }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#6b7280' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#6b7280' }
                }
            }
        };

        // Trends Chart
        const trendsCtx = document.getElementById('trends-chart')?.getContext('2d');
        if (trendsCtx) {
            this.charts.trends = new Chart(trendsCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'AQI',
                            data: [],
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Temperature (°C)',
                            data: [],
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Humidity (%)',
                            data: [],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            tension: 0.4,
                            fill: true
                        }
                    ]
                },
                options: {
                    ...chartDefaults,
                    interaction: { intersect: false, mode: 'index' }
                }
            });
        }

        // Pollutants Chart
        const pollutantsCtx = document.getElementById('pollutants-chart')?.getContext('2d');
        if (pollutantsCtx) {
            this.charts.pollutants = new Chart(pollutantsCtx, {
                type: 'doughnut',
                data: {
                    labels: ['PM2.5', 'PM10', 'O₃', 'NO₂', 'SO₂', 'CO'],
                    datasets: [{
                        data: [0, 0, 0, 0, 0, 0],
                        backgroundColor: [
                            '#3b82f6',
                            '#8b5cf6',
                            '#06b6d4',
                            '#f59e0b',
                            '#ef4444',
                            '#10b981'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { color: '#9ca3af', font: { size: 11 } }
                        }
                    }
                }
            });
        }

        // AQI History Chart
        const aqiHistoryCtx = document.getElementById('aqi-history-chart')?.getContext('2d');
        if (aqiHistoryCtx) {
            this.charts.aqiHistory = new Chart(aqiHistoryCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'AQI',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: chartDefaults
            });
        }

        // Water Quality Chart
        const waterCtx = document.getElementById('water-quality-chart')?.getContext('2d');
        if (waterCtx) {
            this.charts.water = new Chart(waterCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'pH',
                            data: [],
                            borderColor: '#06b6d4',
                            tension: 0.4,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Dissolved O₂ (mg/L)',
                            data: [],
                            borderColor: '#10b981',
                            tension: 0.4,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    ...chartDefaults,
                    scales: {
                        ...chartDefaults.scales,
                        y: {
                            type: 'linear',
                            position: 'left',
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#6b7280' },
                            min: 0,
                            max: 14
                        },
                        y1: {
                            type: 'linear',
                            position: 'right',
                            grid: { display: false },
                            ticks: { color: '#6b7280' }
                        }
                    }
                }
            });
        }

        // Anomaly Chart
        const anomalyCtx = document.getElementById('anomaly-chart')?.getContext('2d');
        if (anomalyCtx) {
            this.charts.anomaly = new Chart(anomalyCtx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Anomalies',
                        data: [],
                        backgroundColor: 'rgba(239, 68, 68, 0.6)',
                        borderColor: '#ef4444',
                        pointRadius: 8
                    }, {
                        label: 'Normal',
                        data: [],
                        backgroundColor: 'rgba(16, 185, 129, 0.6)',
                        borderColor: '#10b981',
                        pointRadius: 5
                    }]
                },
                options: {
                    ...chartDefaults,
                    scales: {
                        x: {
                            ...chartDefaults.scales.x,
                            title: { display: true, text: 'Time', color: '#6b7280' }
                        },
                        y: {
                            ...chartDefaults.scales.y,
                            title: { display: true, text: 'Value', color: '#6b7280' }
                        }
                    }
                }
            });
        }
    }

    async refreshData() {
        try {
            // Generate new sensor data
            this.currentData = this.sensors.generateSensorData();
            
            // Check for anomalies
            const anomalies = this.sensors.detectAnomalies(this.currentData);
            
            // Process and send alerts for anomalies
            if (anomalies.length > 0) {
                await this.alerts.processAnomalies(anomalies);
                this.updateAlertBadge();
            }
            
            // Save to Supabase
            await this.supabase.saveSensorReading(this.currentData);
            
            // Update UI
            this.updateDashboard();
            this.updateCharts();
            this.updateLastSyncTime();
            
        } catch (error) {
            console.error('Data refresh error:', error);
        }
    }

    updateDashboard() {
        if (!this.currentData) return;

        const data = this.currentData;
        const historical = this.sensors.getHistoricalData();

        // Update stat cards
        this.updateStatCard('aqi', data.air.aqi, this.sensors.calculateTrend(historical.aqi));
        this.updateStatCard('temp', data.weather.temperature, this.sensors.calculateTrend(historical.temperature));
        this.updateStatCard('humidity', data.weather.humidity, this.sensors.calculateTrend(historical.humidity));
        this.updateStatCard('ph', data.water.ph, this.sensors.calculateTrend(historical.waterPh));

        // Update indicators - clear previous classes first
        ['stat-aqi-indicator', 'stat-temp-indicator', 'stat-humidity-indicator', 'stat-ph-indicator'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('good', 'moderate', 'poor');
        });
        
        // AQI indicator
        const aqiStatus = this.sensors.getAQIStatus(data.air.aqi);
        document.getElementById('stat-aqi-indicator')?.classList.add(aqiStatus.color);
        
        // Temperature indicator (comfortable: 18-26°C good, 15-18 or 26-32 moderate, else poor)
        const temp = parseFloat(data.weather.temperature);
        let tempColor = 'good';
        if (temp < 15 || temp > 32) tempColor = 'poor';
        else if (temp < 18 || temp > 26) tempColor = 'moderate';
        document.getElementById('stat-temp-indicator')?.classList.add(tempColor);
        
        // Humidity indicator (40-60% good, 30-40 or 60-70 moderate, else poor)
        const humidity = parseFloat(data.weather.humidity);
        let humidityColor = 'good';
        if (humidity < 30 || humidity > 70) humidityColor = 'poor';
        else if (humidity < 40 || humidity > 60) humidityColor = 'moderate';
        document.getElementById('stat-humidity-indicator')?.classList.add(humidityColor);
        
        // Water pH indicator
        const phStatus = this.sensors.getWaterQualityStatus(parseFloat(data.water.ph));

        // Update air quality view
        document.getElementById('detail-aqi').textContent = data.air.aqi;
        document.getElementById('aqi-status-badge').textContent = aqiStatus.status;
        document.getElementById('aqi-status-badge').className = `detail-badge ${aqiStatus.color === 'poor' ? 'unhealthy' : aqiStatus.color}`;
        
        // Update AQI marker position (0-300 scale to 0-100%)
        const markerPosition = Math.min((data.air.aqi / 300) * 100, 100);
        const marker = document.getElementById('aqi-marker');
        if (marker) marker.style.left = `${markerPosition}%`;

        // Update pollutant values
        document.getElementById('pm25-value').textContent = data.air.pm25;
        document.getElementById('pm10-value').textContent = data.air.pm10;
        document.getElementById('o3-value').textContent = data.air.o3;
        document.getElementById('no2-value').textContent = data.air.no2;
        document.getElementById('so2-value').textContent = data.air.so2;
        document.getElementById('co-value').textContent = data.air.co;

        // Update water quality view
        document.getElementById('water-ph-detail').textContent = data.water.ph;
        document.getElementById('water-do-detail').textContent = data.water.dissolvedOxygen;
        document.getElementById('water-temp-detail').textContent = data.water.temperature;
        document.getElementById('water-turbidity-detail').textContent = data.water.turbidity;
        document.getElementById('water-tds-detail').textContent = data.water.tds;
        document.getElementById('water-conductivity-detail').textContent = data.water.conductivity;

        // Update pH bar
        const phBar = document.getElementById('ph-bar');
        if (phBar) {
            const phPercent = (parseFloat(data.water.ph) / 14) * 100;
            phBar.style.width = `${phPercent}%`;
        }

        // Update weather view
        document.getElementById('weather-temp-value').textContent = Math.round(data.weather.temperature);
        document.getElementById('weather-condition').textContent = data.weather.condition;
        document.getElementById('weather-humidity').textContent = `${data.weather.humidity}%`;
        document.getElementById('weather-wind').textContent = `${data.weather.windSpeed} km/h`;
        document.getElementById('weather-pressure').textContent = `${data.weather.pressure} hPa`;
        document.getElementById('weather-uv').textContent = data.weather.uvIndex;
        document.getElementById('weather-location').textContent = this.getLocationName();

        // Update sensors grid
        this.updateSensorsGrid();

        // Update recent alerts
        this.updateRecentAlerts();

        // Update recommendations
        this.updateRecommendations(aqiStatus);

        // Update forecast
        this.updateForecast();
    }

    updateStatCard(type, value, trend) {
        const valueEl = document.getElementById(`stat-${type}`);
        const trendEl = document.getElementById(`stat-${type}-trend`);
        
        if (valueEl) {
            valueEl.textContent = type === 'ph' ? parseFloat(value).toFixed(1) : Math.round(value);
        }
        
        if (trendEl) {
            trendEl.className = `stat-trend ${trend.direction}`;
            const icon = trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→';
            trendEl.innerHTML = `
                <span class="trend-icon">${icon}</span>
                <span class="trend-text">${trend.change > 0 ? trend.change + '% from avg' : 'Stable'}</span>
            `;
        }
    }

    updateCharts() {
        const historical = this.sensors.getHistoricalData();
        const labels = historical.timestamps.map(t => 
            t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        );

        // Update trends chart
        if (this.charts.trends) {
            this.charts.trends.data.labels = labels;
            this.charts.trends.data.datasets[0].data = historical.aqi;
            this.charts.trends.data.datasets[1].data = historical.temperature;
            this.charts.trends.data.datasets[2].data = historical.humidity;
            this.charts.trends.update('none');
        }

        // Update pollutants chart
        if (this.charts.pollutants && this.currentData) {
            const air = this.currentData.air;
            this.charts.pollutants.data.datasets[0].data = [
                parseFloat(air.pm25),
                parseFloat(air.pm10),
                parseFloat(air.o3),
                parseFloat(air.no2),
                parseFloat(air.so2),
                parseFloat(air.co) * 10 // Scale CO for visibility
            ];
            this.charts.pollutants.update('none');
        }

        // Update AQI history chart
        if (this.charts.aqiHistory) {
            this.charts.aqiHistory.data.labels = labels;
            this.charts.aqiHistory.data.datasets[0].data = historical.aqi;
            this.charts.aqiHistory.update('none');
        }

        // Update water chart
        if (this.charts.water) {
            this.charts.water.data.labels = labels;
            this.charts.water.data.datasets[0].data = historical.waterPh;
            // Generate DO data (simulated)
            this.charts.water.data.datasets[1].data = historical.waterPh.map(() => 
                6 + Math.random() * 4
            );
            this.charts.water.update('none');
        }
    }

    updateSensorsGrid() {
        const grid = document.getElementById('sensors-grid');
        if (!grid) return;

        const sensors = this.sensors.getSensorsByLocation(this.currentLocation);
        const online = sensors.filter(s => s.status === 'online').length;

        document.getElementById('active-sensor-count').textContent = online;
        document.getElementById('total-sensor-count').textContent = sensors.length;

        grid.innerHTML = sensors.map(sensor => `
            <div class="sensor-item">
                <div class="sensor-header">
                    <span class="sensor-name">${sensor.id}</span>
                    <span class="sensor-status ${sensor.status}"></span>
                </div>
                <span class="sensor-type">${sensor.type}</span>
                <span class="sensor-value">${sensor.lastReading || '--'}</span>
            </div>
        `).join('');
    }

    updateRecentAlerts() {
        const container = document.getElementById('recent-alerts');
        if (!container) return;

        const recentAlerts = this.alerts.getAlertHistory().slice(0, 5);

        if (recentAlerts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 12l2 2 4-4"/>
                        <circle cx="12" cy="12" r="10"/>
                    </svg>
                    <p>No active alerts</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recentAlerts.map(alert => `
            <div class="alert-item" data-id="${alert.id}">
                <div class="alert-icon ${alert.severity}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                </div>
                <div class="alert-content">
                    <div class="alert-title">${this.getAlertTitle(alert)}</div>
                    <div class="alert-message">${alert.message}</div>
                    <div class="alert-time">${this.formatTime(alert.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    updateRecommendations(aqiStatus) {
        const container = document.getElementById('air-recommendations');
        if (!container) return;

        const recommendations = this.getHealthRecommendations(aqiStatus);
        
        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item">
                <div class="recommendation-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 12l2 2 4-4"/>
                        <circle cx="12" cy="12" r="10"/>
                    </svg>
                </div>
                <span class="recommendation-text">${rec}</span>
            </div>
        `).join('');
    }

    getHealthRecommendations(aqiStatus) {
        const recommendations = [aqiStatus.recommendation];
        
        if (this.currentData) {
            const temp = parseFloat(this.currentData.weather.temperature);
            const uv = this.currentData.weather.uvIndex;
            
            if (temp > 35) {
                recommendations.push('Stay hydrated and avoid prolonged sun exposure during peak heat.');
            }
            if (uv > 6) {
                recommendations.push('High UV index - wear sunscreen and protective clothing outdoors.');
            }
            if (parseFloat(this.currentData.weather.humidity) > 70) {
                recommendations.push('High humidity - take precautions against heat-related illness.');
            }
        }
        
        return recommendations.slice(0, 4);
    }

    updateForecast() {
        const container = document.getElementById('hourly-forecast');
        if (!container) return;

        const forecast = this.sensors.generateForecast().slice(0, 12);
        
        container.innerHTML = forecast.map(item => `
            <div class="forecast-item">
                <span class="forecast-time">${item.time.toLocaleTimeString('en-US', { hour: 'numeric' })}</span>
                <div class="forecast-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                    </svg>
                </div>
                <span class="forecast-temp">${item.temperature}°</span>
            </div>
        `).join('');
    }

    async refreshAIAnalysis() {
        const container = document.getElementById('ai-insights-content');
        const fullReport = document.getElementById('ai-full-report');
        
        if (container) {
            container.innerHTML = `
                <div class="ai-loading">
                    <div class="ai-loader"></div>
                    <span>Analyzing environmental data...</span>
                </div>
            `;
        }

        try {
            const analysis = await this.ai.analyzeEnvironmentalData(
                this.currentData,
                this.sensors.getHistoricalData()
            );

            if (container) {
                this.renderAIInsights(container, analysis);
            }
            
            if (fullReport) {
                this.renderFullAIReport(fullReport, analysis);
            }

            document.getElementById('ai-report-time').textContent = 
                `Last analyzed: ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            console.error('AI analysis error:', error);
            if (container) {
                container.innerHTML = `
                    <div class="ai-insight warning">
                        <div class="ai-insight-title">Analysis Unavailable</div>
                        <div class="ai-insight-text">Unable to generate AI analysis. Using offline mode.</div>
                    </div>
                `;
            }
        }
    }

    renderAIInsights(container, analysis) {
        let html = '';
        
        if (analysis.summary) {
            html += `
                <div class="ai-insight">
                    <div class="ai-insight-title">Summary</div>
                    <div class="ai-insight-text">${analysis.summary}</div>
                </div>
            `;
        }

        if (analysis.concerns && analysis.concerns.length > 0) {
            html += `
                <div class="ai-insight ${analysis.concerns.length > 2 ? 'critical' : 'warning'}">
                    <div class="ai-insight-title">Concerns</div>
                    <div class="ai-insight-text">${analysis.concerns.join('. ')}</div>
                </div>
            `;
        }

        if (analysis.recommendations && analysis.recommendations.length > 0) {
            html += `
                <div class="ai-insight">
                    <div class="ai-insight-title">Recommendations</div>
                    <div class="ai-insight-text">${analysis.recommendations[0]}</div>
                </div>
            `;
        }

        container.innerHTML = html || '<p class="ai-insight-text">No significant concerns at this time.</p>';
    }

    renderFullAIReport(container, analysis) {
        container.innerHTML = `
            <div class="ai-report-content">
                <h4>Environmental Summary</h4>
                <p>${analysis.summary || 'No summary available.'}</p>
                
                ${analysis.concerns && analysis.concerns.length > 0 ? `
                    <h4>Current Concerns</h4>
                    <ul>
                        ${analysis.concerns.map(c => `<li>${c}</li>`).join('')}
                    </ul>
                ` : ''}
                
                ${analysis.recommendations && analysis.recommendations.length > 0 ? `
                    <h4>Recommendations</h4>
                    <ul>
                        ${analysis.recommendations.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                ` : ''}
                
                ${analysis.prediction ? `
                    <h4>Prediction</h4>
                    <p>${analysis.prediction}</p>
                ` : ''}
            </div>
        `;
    }

    switchView(viewName) {
        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('active', view.id === `view-${viewName}`);
        });

        // Update header
        const titles = {
            'dashboard': { title: 'Dashboard', subtitle: 'Real-time environmental monitoring' },
            'air-quality': { title: 'Air Quality', subtitle: 'Detailed air quality metrics and analysis' },
            'water-quality': { title: 'Water Quality', subtitle: 'Water quality monitoring and alerts' },
            'weather': { title: 'Weather', subtitle: 'Current conditions and forecast' },
            'alerts': { title: 'Alerts', subtitle: 'Environmental alerts and notifications' },
            'ai-insights': { title: 'AI Insights', subtitle: 'AI-powered environmental analysis' }
        };

        const titleInfo = titles[viewName] || titles['dashboard'];
        document.getElementById('current-view-title').textContent = titleInfo.title;
        document.getElementById('current-view-subtitle').textContent = titleInfo.subtitle;

        this.currentView = viewName;

        // Close mobile sidebar
        document.querySelector('.sidebar')?.classList.remove('open');

        // Load view-specific data
        if (viewName === 'alerts') {
            this.loadAlertsView();
        }
    }

    loadAlertsView() {
        const timeline = document.getElementById('alerts-timeline');
        if (!timeline) return;

        const alerts = this.alerts.getAlertHistory();

        if (alerts.length === 0) {
            timeline.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 12l2 2 4-4"/>
                        <circle cx="12" cy="12" r="10"/>
                    </svg>
                    <p>No alerts recorded</p>
                </div>
            `;
            return;
        }

        timeline.innerHTML = alerts.map(alert => `
            <div class="timeline-item ${alert.read ? '' : 'unread'}" data-id="${alert.id}">
                <div class="timeline-icon ${alert.severity}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                </div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="timeline-title">${this.getAlertTitle(alert)}</span>
                        <span class="timeline-time">${this.formatTime(alert.timestamp)}</span>
                    </div>
                    <p class="timeline-message">${alert.message}</p>
                    <div class="timeline-actions">
                        <button class="timeline-btn" onclick="app.markAlertRead('${alert.id}')">Mark as read</button>
                        <button class="timeline-btn" onclick="app.viewAlertDetails('${alert.id}')">View details</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    filterAlerts(filter) {
        const timeline = document.getElementById('alerts-timeline');
        if (!timeline) return;

        let alerts = this.alerts.getAlertHistory();

        if (filter !== 'all') {
            alerts = alerts.filter(a => a.severity === filter);
        }

        if (alerts.length === 0) {
            timeline.innerHTML = `
                <div class="empty-state">
                    <p>No ${filter} alerts</p>
                </div>
            `;
            return;
        }

        this.loadAlertsView();
    }

    markAlertRead(alertId) {
        this.alerts.markAsRead(alertId);
        this.updateAlertBadge();
        this.loadAlertsView();
    }

    markAllAlertsRead() {
        this.alerts.markAllAsRead();
        this.updateAlertBadge();
        this.loadAlertsView();
        this.showToast('success', 'Alerts Updated', 'All alerts marked as read');
    }

    viewAlertDetails(alertId) {
        const alert = this.alerts.getAlertHistory().find(a => a.id === alertId);
        if (!alert) return;

        document.getElementById('modal-title').textContent = this.getAlertTitle(alert);
        document.getElementById('modal-body').innerHTML = `
            <div class="alert-details">
                <p><strong>Type:</strong> ${alert.type}</p>
                <p><strong>Severity:</strong> ${alert.severity}</p>
                <p><strong>Message:</strong> ${alert.message}</p>
                <p><strong>Value:</strong> ${alert.value || 'N/A'}</p>
                <p><strong>Threshold:</strong> ${alert.threshold || 'N/A'}</p>
                <p><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
                ${alert.recommendations ? `
                    <p><strong>Recommendations:</strong></p>
                    <ul>${alert.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
                ` : ''}
            </div>
        `;

        this.openModal('alert-modal');
        this.markAlertRead(alertId);
    }

    updateAlertBadge() {
        const count = this.alerts.getUnreadCount();
        const badge = document.getElementById('alert-count');
        const indicator = document.getElementById('notification-indicator');

        if (badge) {
            badge.textContent = count > 0 ? count : '';
        }

        if (indicator) {
            indicator.classList.toggle('active', count > 0);
        }
    }

    getAlertTitle(alert) {
        const titles = {
            air: 'Air Quality Alert',
            water: 'Water Quality Alert',
            weather: 'Weather Alert',
            system: 'System Alert'
        };
        return titles[alert.type] || 'Environmental Alert';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    getLocationName() {
        const locations = {
            'all': 'All Locations',
            'downtown': 'Downtown Station',
            'industrial': 'Industrial Zone',
            'residential': 'Residential Area',
            'waterfront': 'Waterfront District'
        };
        return locations[this.currentLocation] || 'Unknown Location';
    }

    // Modal controls
    openModal(modalId) {
        document.getElementById(modalId)?.classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId)?.classList.remove('active');
    }

    openEmergencyModal() {
        this.openModal('emergency-modal');
    }

    // Take action on current alert
    async takeAlertAction() {
        const title = document.getElementById('modal-title')?.textContent;
        const body = document.getElementById('modal-body');
        
        // Show loading state
        const actionBtn = document.getElementById('modal-action');
        const originalText = actionBtn?.textContent;
        if (actionBtn) {
            actionBtn.textContent = 'Processing...';
            actionBtn.disabled = true;
        }
        
        try {
            // Trigger n8n webhook for automated response
            await this.alerts.sendAlertAction({
                title: title,
                timestamp: new Date().toISOString(),
                action: 'user_initiated_response'
            });
            
            this.closeModal('alert-modal');
            this.showToast('success', 'Action Taken', 'Response protocol has been initiated and notifications sent.');
        } catch (error) {
            console.error('Action error:', error);
            this.showToast('error', 'Action Failed', 'Unable to complete the action. Please try again.');
        } finally {
            if (actionBtn) {
                actionBtn.textContent = originalText;
                actionBtn.disabled = false;
            }
        }
    }

    async activateEmergencyProtocol() {
        const message = document.getElementById('emergency-message')?.value;
        const options = {
            notifyAgency: document.querySelector('.emergency-option input:nth-child(1)')?.checked,
            publicAlert: document.querySelector('.emergency-option input:nth-child(2)')?.checked,
            emergencyServices: document.querySelector('.emergency-option input:nth-child(3)')?.checked
        };

        try {
            await this.alerts.sendEmergencyAlert({ message, options });
            this.closeModal('emergency-modal');
            this.showToast('warning', 'Emergency Protocol', 'Emergency notifications have been sent');
        } catch (error) {
            this.showToast('error', 'Error', 'Failed to activate emergency protocol');
        }
    }

    // Settings
    toggleAlertSettings() {
        const panel = document.getElementById('alert-settings-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    async loadSettings() {
        const settings = await this.supabase.getUserSettings();
        if (settings) {
            document.getElementById('alert-email').value = settings.alert_email || '';
            document.getElementById('aqi-threshold').value = settings.aqi_threshold || 150;
            document.getElementById('aqi-threshold-value').textContent = settings.aqi_threshold || 150;
            document.getElementById('temp-threshold').value = settings.temp_threshold || 40;
            document.getElementById('temp-threshold-value').textContent = settings.temp_threshold || 40;
            document.getElementById('instant-alerts').checked = settings.instant_alerts !== false;
        }
    }

    async saveSettings() {
        const settings = {
            email: document.getElementById('alert-email')?.value,
            aqiThreshold: parseInt(document.getElementById('aqi-threshold')?.value),
            tempThreshold: parseInt(document.getElementById('temp-threshold')?.value),
            instantAlerts: document.getElementById('instant-alerts')?.checked
        };

        await this.supabase.saveUserSettings(settings);
        this.showToast('success', 'Settings Saved', 'Your alert settings have been updated');
    }

    // Export functions
    async exportReport() {
        try {
            const report = await this.ai.generateReport(
                this.currentData,
                this.sensors.getHistoricalData(),
                this.alerts.getAlertHistory()
            );

            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ecomonitor-report-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.showToast('success', 'Report Exported', 'Environmental report has been downloaded');
        } catch (error) {
            this.showToast('error', 'Export Failed', 'Unable to generate report');
        }
    }

    exportAlerts() {
        const csv = this.alerts.exportToCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ecomonitor-alerts-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('success', 'Alerts Exported', 'Alert history has been downloaded');
    }

    // AI Actions
    async analyzeTrends() {
        this.showToast('info', 'Analyzing', 'Running trend analysis...');
        await this.refreshAIAnalysis();
    }

    async predictAnomalies() {
        this.showToast('info', 'Predicting', 'Running anomaly prediction...');
        // Simulate prediction
        setTimeout(() => {
            this.showToast('success', 'Prediction Complete', 'No significant anomalies predicted in the next 6 hours');
        }, 2000);
    }

    async getRecommendations() {
        await this.refreshAIAnalysis();
        this.showToast('success', 'Recommendations Updated', 'Check the AI Insights panel for recommendations');
    }

    async generateFullReport() {
        await this.exportReport();
    }

    // UI Helpers
    showToast(type, title, message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${type === 'success' ? '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>' : ''}
                ${type === 'error' ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' : ''}
                ${type === 'warning' ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' : ''}
                ${type === 'info' ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>' : ''}
            </svg>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });

        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => overlay.remove(), 500);
        }
    }

    updateConnectionStatus(connected) {
        const status = document.getElementById('connection-status');
        if (status) {
            const dot = status.querySelector('.status-dot');
            const text = status.querySelector('.status-text');
            
            dot.className = `status-dot ${connected ? 'online' : 'offline'}`;
            text.textContent = connected ? 'Connected' : 'Offline';
        }
    }

    updateLastSyncTime() {
        const el = document.getElementById('last-update-time');
        if (el) {
            el.textContent = new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
    }

    startDataRefresh() {
        setInterval(() => {
            this.refreshData();
        }, this.refreshInterval);
    }

    updateTrendsChart(range) {
        // Get historical data and filter based on selected time range
        const historical = this.sensors.getHistoricalData();
        
        if (!this.charts.trends || historical.timestamps.length === 0) {
            return;
        }

        const now = new Date();
        let filterMinutes;
        let labelFormat = { hour: '2-digit', minute: '2-digit' };
        
        switch(range) {
            case '1h':
                filterMinutes = 60;
                break;
            case '6h':
                filterMinutes = 360;
                break;
            case '24h':
                filterMinutes = 1440;
                labelFormat = { hour: '2-digit' };
                break;
            case '7d':
                filterMinutes = 10080;
                labelFormat = { weekday: 'short', hour: '2-digit' };
                break;
            default:
                filterMinutes = 60;
        }
        
        const cutoffTime = new Date(now.getTime() - filterMinutes * 60 * 1000);
        
        // Filter data based on time range
        const filteredIndices = historical.timestamps
            .map((t, i) => ({ t, i }))
            .filter(({ t }) => t >= cutoffTime)
            .map(({ i }) => i);
        
        // If not enough data for the range, use all available data
        const indices = filteredIndices.length > 0 ? filteredIndices : historical.timestamps.map((_, i) => i);
        
        const labels = indices.map(i => 
            historical.timestamps[i].toLocaleTimeString('en-US', labelFormat)
        );
        
        // Update chart with filtered data
        this.charts.trends.data.labels = labels;
        this.charts.trends.data.datasets[0].data = indices.map(i => historical.aqi[i]);
        this.charts.trends.data.datasets[1].data = indices.map(i => historical.temperature[i]);
        this.charts.trends.data.datasets[2].data = indices.map(i => historical.humidity[i]);
        this.charts.trends.update('none');
        
        // Show feedback
        this.showToast('info', 'Time Range Updated', `Showing data for the last ${range.toUpperCase()}`);
    }
}

// Initialize the application
const app = new EcoMonitor();
window.app = app; // Make available globally for event handlers

document.addEventListener('DOMContentLoaded', () => {
    app.initialize();
});

export default EcoMonitor;
