/**
 * EcoMonitor - Sensor Data Simulation Module
 * Simulates IoT sensor data for environmental monitoring
 */

class SensorSimulator {
    constructor() {
        this.sensors = this.initializeSensors();
        this.historicalData = {
            aqi: [],
            temperature: [],
            humidity: [],
            waterPh: [],
            timestamps: []
        };
        this.maxHistoricalPoints = 50;
    }

    initializeSensors() {
        return [
            { id: 'AQ-001', name: 'Air Quality #1', type: 'air', location: 'downtown', status: 'online', lastReading: null },
            { id: 'AQ-002', name: 'Air Quality #2', type: 'air', location: 'industrial', status: 'online', lastReading: null },
            { id: 'AQ-003', name: 'Air Quality #3', type: 'air', location: 'residential', status: 'online', lastReading: null },
            { id: 'WQ-001', name: 'Water Quality #1', type: 'water', location: 'waterfront', status: 'online', lastReading: null },
            { id: 'WQ-002', name: 'Water Quality #2', type: 'water', location: 'industrial', status: 'online', lastReading: null },
            { id: 'WX-001', name: 'Weather Station #1', type: 'weather', location: 'downtown', status: 'online', lastReading: null },
            { id: 'WX-002', name: 'Weather Station #2', type: 'weather', location: 'residential', status: 'online', lastReading: null },
            { id: 'TH-001', name: 'Temp/Humidity #1', type: 'environmental', location: 'downtown', status: 'online', lastReading: null }
        ];
    }

    generateSensorData() {
        const timestamp = new Date();
        const hour = timestamp.getHours();
        const rushHourFactor = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19) ? 1.3 : 1;
        const nightFactor = (hour >= 22 || hour <= 5) ? 0.7 : 1;

        const data = {
            timestamp: timestamp.toISOString(),
            air: {
                aqi: Math.round(this.generateValue(45, 180, rushHourFactor)),
                pm25: this.generateValue(8, 55, rushHourFactor).toFixed(1),
                pm10: this.generateValue(15, 85, rushHourFactor).toFixed(1),
                o3: this.generateValue(20, 70, nightFactor).toFixed(1),
                no2: this.generateValue(10, 50, rushHourFactor).toFixed(1),
                so2: this.generateValue(2, 20, 1).toFixed(1),
                co: this.generateValue(0.2, 2.5, rushHourFactor).toFixed(2)
            },
            weather: {
                temperature: this.generateValue(18, 38, 1).toFixed(1),
                humidity: this.generateValue(35, 85, 1).toFixed(0),
                pressure: this.generateValue(1008, 1025, 1).toFixed(0),
                windSpeed: this.generateValue(5, 35, 1).toFixed(1),
                windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
                uvIndex: Math.round(this.generateValue(1, 11, hour >= 10 && hour <= 16 ? 1.5 : 0.5)),
                visibility: this.generateValue(5, 20, 1).toFixed(1),
                condition: this.getWeatherCondition()
            },
            water: {
                ph: this.generateValue(6.2, 8.5, 1).toFixed(2),
                dissolvedOxygen: this.generateValue(6, 12, 1).toFixed(1),
                temperature: this.generateValue(15, 28, 1).toFixed(1),
                turbidity: this.generateValue(0.5, 15, 1).toFixed(1),
                tds: Math.round(this.generateValue(150, 500, 1)),
                conductivity: Math.round(this.generateValue(200, 800, 1))
            }
        };

        this.updateHistoricalData(data);
        this.updateSensorReadings(data);
        return data;
    }

    generateValue(min, max, factor = 1) {
        const base = min + (Math.random() * (max - min));
        const adjusted = base * factor;
        const noise = (Math.random() - 0.5) * (max - min) * 0.1;
        return Math.max(min, Math.min(max * 1.2, adjusted + noise));
    }

    getWeatherCondition() {
        const conditions = [
            { name: 'Clear', weight: 30 }, { name: 'Partly Cloudy', weight: 25 },
            { name: 'Cloudy', weight: 15 }, { name: 'Overcast', weight: 10 },
            { name: 'Light Rain', weight: 8 }, { name: 'Rain', weight: 5 },
            { name: 'Thunderstorm', weight: 3 }, { name: 'Fog', weight: 2 }, { name: 'Haze', weight: 2 }
        ];
        const totalWeight = conditions.reduce((sum, c) => sum + c.weight, 0);
        let random = Math.random() * totalWeight;
        for (const condition of conditions) {
            random -= condition.weight;
            if (random <= 0) return condition.name;
        }
        return 'Clear';
    }

    updateHistoricalData(data) {
        const timestamp = new Date(data.timestamp);
        this.historicalData.aqi.push(parseFloat(data.air.aqi));
        this.historicalData.temperature.push(parseFloat(data.weather.temperature));
        this.historicalData.humidity.push(parseFloat(data.weather.humidity));
        this.historicalData.waterPh.push(parseFloat(data.water.ph));
        this.historicalData.timestamps.push(timestamp);

        if (this.historicalData.timestamps.length > this.maxHistoricalPoints) {
            this.historicalData.aqi.shift();
            this.historicalData.temperature.shift();
            this.historicalData.humidity.shift();
            this.historicalData.waterPh.shift();
            this.historicalData.timestamps.shift();
        }
    }

    updateSensorReadings(data) {
        this.sensors.forEach(sensor => {
            if (Math.random() < 0.02) sensor.status = sensor.status === 'online' ? 'warning' : 'online';
            if (Math.random() < 0.005) sensor.status = 'offline';
            if (sensor.status === 'offline' && Math.random() < 0.1) sensor.status = 'online';

            switch (sensor.type) {
                case 'air': sensor.lastReading = `AQI: ${data.air.aqi}`; break;
                case 'water': sensor.lastReading = `pH: ${data.water.ph}`; break;
                case 'weather': sensor.lastReading = `${data.weather.temperature}°C`; break;
                case 'environmental': sensor.lastReading = `${data.weather.humidity}% RH`; break;
            }
        });
    }

    getSensors() { return this.sensors; }
    getSensorsByLocation(location) {
        if (location === 'all') return this.sensors;
        return this.sensors.filter(s => s.location === location);
    }
    getHistoricalData() { return this.historicalData; }

    getAQIStatus(aqi) {
        if (aqi <= 50) return { status: 'Good', color: 'good', recommendation: 'Air quality is satisfactory. Enjoy outdoor activities.' };
        if (aqi <= 100) return { status: 'Moderate', color: 'moderate', recommendation: 'Air quality is acceptable. Sensitive individuals should limit prolonged outdoor exertion.' };
        if (aqi <= 150) return { status: 'Unhealthy for Sensitive', color: 'moderate', recommendation: 'Members of sensitive groups may experience health effects. General public less likely affected.' };
        if (aqi <= 200) return { status: 'Unhealthy', color: 'poor', recommendation: 'Everyone may begin to experience health effects. Sensitive groups may experience more serious effects.' };
        if (aqi <= 300) return { status: 'Very Unhealthy', color: 'poor', recommendation: 'Health alert: everyone may experience more serious health effects. Avoid outdoor activities.' };
        return { status: 'Hazardous', color: 'poor', recommendation: 'Health warnings of emergency conditions. Everyone should avoid all outdoor activities.' };
    }

    getWaterQualityStatus(ph) {
        if (ph >= 6.5 && ph <= 8.5) return { status: 'Normal', color: 'good' };
        if (ph >= 6.0 && ph < 6.5) return { status: 'Slightly Acidic', color: 'moderate' };
        if (ph > 8.5 && ph <= 9.0) return { status: 'Slightly Alkaline', color: 'moderate' };
        return { status: 'Abnormal', color: 'poor' };
    }

    generateForecast() {
        const forecast = [];
        const now = new Date();
        const currentTemp = parseFloat(this.historicalData.temperature[this.historicalData.temperature.length - 1] || 25);

        for (let i = 0; i < 24; i++) {
            const hour = new Date(now.getTime() + i * 60 * 60 * 1000);
            const hourOfDay = hour.getHours();
            let tempVariation = 0;
            if (hourOfDay >= 6 && hourOfDay <= 14) tempVariation = (hourOfDay - 6) * 0.5;
            else if (hourOfDay > 14 && hourOfDay <= 20) tempVariation = 4 - (hourOfDay - 14) * 0.6;
            else tempVariation = -2;

            forecast.push({
                time: hour,
                temperature: Math.round(currentTemp + tempVariation + (Math.random() - 0.5) * 3),
                condition: this.getWeatherCondition(),
                precipitation: Math.round(Math.random() * 30)
            });
        }
        return forecast;
    }

    detectAnomalies(data) {
        const anomalies = [];
        if (data.air.aqi > 150) {
            anomalies.push({ type: 'air', severity: data.air.aqi > 200 ? 'critical' : 'warning', message: `High AQI detected: ${data.air.aqi}`, value: data.air.aqi, threshold: 150, timestamp: data.timestamp });
        }
        if (parseFloat(data.air.pm25) > 35) {
            anomalies.push({ type: 'air', severity: parseFloat(data.air.pm25) > 55 ? 'critical' : 'warning', message: `Elevated PM2.5 levels: ${data.air.pm25} μg/m³`, value: parseFloat(data.air.pm25), threshold: 35, timestamp: data.timestamp });
        }
        if (parseFloat(data.weather.temperature) > 38) {
            anomalies.push({ type: 'weather', severity: 'warning', message: `Extreme heat warning: ${data.weather.temperature}°C`, value: parseFloat(data.weather.temperature), threshold: 38, timestamp: data.timestamp });
        }
        const ph = parseFloat(data.water.ph);
        if (ph < 6.5 || ph > 8.5) {
            anomalies.push({ type: 'water', severity: (ph < 6.0 || ph > 9.0) ? 'critical' : 'warning', message: `Abnormal water pH: ${data.water.ph}`, value: ph, threshold: '6.5-8.5', timestamp: data.timestamp });
        }
        if (parseFloat(data.water.dissolvedOxygen) < 6) {
            anomalies.push({ type: 'water', severity: parseFloat(data.water.dissolvedOxygen) < 4 ? 'critical' : 'warning', message: `Low dissolved oxygen: ${data.water.dissolvedOxygen} mg/L`, value: parseFloat(data.water.dissolvedOxygen), threshold: 6, timestamp: data.timestamp });
        }
        return anomalies;
    }

    calculateTrend(dataArray) {
        if (dataArray.length < 2) return { direction: 'stable', change: 0 };
        const recent = dataArray.slice(-5);
        const older = dataArray.slice(-10, -5);
        if (recent.length === 0 || older.length === 0) return { direction: 'stable', change: 0 };
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        const change = ((recentAvg - olderAvg) / olderAvg * 100).toFixed(1);
        if (Math.abs(change) < 2) return { direction: 'stable', change: 0 };
        return { direction: change > 0 ? 'up' : 'down', change: Math.abs(change) };
    }
}

export default SensorSimulator;
