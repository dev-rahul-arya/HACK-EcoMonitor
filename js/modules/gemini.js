/**
 * EcoMonitor - Gemini AI Integration Module
 * Handles AI-powered analysis, anomaly detection, and recommendations
 */

import CONFIG from '../config.js';

class GeminiAI {
    constructor() {
        this.apiKey = CONFIG.GEMINI.API_KEY;
        this.model = CONFIG.GEMINI.MODEL;
        this.apiUrl = CONFIG.GEMINI.API_URL;
        this.isConfigured = this.apiKey && this.apiKey.length > 10;
    }

    async analyzeEnvironmentalData(sensorData, historicalData) {
        if (!this.isConfigured) {
            console.log('⚠️ Gemini API not configured, using offline analysis');
            return this.getOfflineAnalysis(sensorData);
        }

        const prompt = this.buildAnalysisPrompt(sensorData, historicalData);
        
        try {
            console.log('🤖 Sending request to Gemini API...');
            const response = await this.callGeminiAPI(prompt);
            console.log('✅ Gemini API response received');
            return this.parseAIResponse(response);
        } catch (error) {
            console.error('❌ Gemini API error:', error);
            return this.getOfflineAnalysis(sensorData);
        }
    }

    buildAnalysisPrompt(sensorData, historicalData) {
        return `You are an environmental monitoring AI assistant. Analyze the following real-time environmental data and provide insights:

CURRENT SENSOR DATA:
- Air Quality Index (AQI): ${sensorData.air.aqi}
- PM2.5: ${sensorData.air.pm25} μg/m³
- PM10: ${sensorData.air.pm10} μg/m³
- Ozone (O3): ${sensorData.air.o3} ppb
- Nitrogen Dioxide (NO2): ${sensorData.air.no2} ppb
- Sulfur Dioxide (SO2): ${sensorData.air.so2} ppb
- Carbon Monoxide (CO): ${sensorData.air.co} ppm

WEATHER DATA:
- Temperature: ${sensorData.weather.temperature}°C
- Humidity: ${sensorData.weather.humidity}%
- Wind Speed: ${sensorData.weather.windSpeed} km/h
- UV Index: ${sensorData.weather.uvIndex}
- Condition: ${sensorData.weather.condition}

WATER QUALITY:
- pH Level: ${sensorData.water.ph}
- Dissolved Oxygen: ${sensorData.water.dissolvedOxygen} mg/L
- Turbidity: ${sensorData.water.turbidity} NTU
- TDS: ${sensorData.water.tds} ppm

Please provide:
1. SUMMARY: A brief 2-3 sentence overall assessment
2. CONCERNS: List any environmental concerns detected (if any)
3. RECOMMENDATIONS: 3-4 specific actionable recommendations for residents
4. PREDICTION: Brief prediction for the next 6-12 hours based on current trends

Format your response clearly with these section headers.`;
    }

    async callGeminiAPI(prompt) {
        const url = `${this.apiUrl}/${this.model}:generateContent?key=${this.apiKey}`;
        
        console.log('📡 Calling Gemini API with model:', this.model);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API error response:', errorText);
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('📝 Gemini response length:', textContent.length, 'chars');
        return textContent;
    }

    parseAIResponse(response) {
        // Parse the structured response from Gemini
        const sections = {
            summary: '',
            concerns: [],
            recommendations: [],
            prediction: ''
        };

        const lines = response.split('\n');
        let currentSection = '';

        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.toUpperCase().includes('SUMMARY')) {
                currentSection = 'summary';
                continue;
            } else if (trimmed.toUpperCase().includes('CONCERN')) {
                currentSection = 'concerns';
                continue;
            } else if (trimmed.toUpperCase().includes('RECOMMENDATION')) {
                currentSection = 'recommendations';
                continue;
            } else if (trimmed.toUpperCase().includes('PREDICTION')) {
                currentSection = 'prediction';
                continue;
            }

            if (trimmed && currentSection) {
                const cleanLine = trimmed.replace(/^[-•*\d.)\s]+/, '').trim();
                if (cleanLine) {
                    if (currentSection === 'concerns' || currentSection === 'recommendations') {
                        sections[currentSection].push(cleanLine);
                    } else {
                        sections[currentSection] += (sections[currentSection] ? ' ' : '') + cleanLine;
                    }
                }
            }
        }

        return sections;
    }

    // Offline analysis when API is not configured or fails
    getOfflineAnalysis(sensorData) {
        const aqi = sensorData.air.aqi;
        const temp = parseFloat(sensorData.weather.temperature);
        const ph = parseFloat(sensorData.water.ph);
        const humidity = parseFloat(sensorData.weather.humidity);

        const concerns = [];
        const recommendations = [];

        // Analyze AQI
        let airQualityAssessment = '';
        if (aqi <= 50) {
            airQualityAssessment = 'Air quality is good.';
        } else if (aqi <= 100) {
            airQualityAssessment = 'Air quality is moderate.';
            recommendations.push('Sensitive individuals should consider limiting prolonged outdoor exertion.');
        } else if (aqi <= 150) {
            airQualityAssessment = 'Air quality is unhealthy for sensitive groups.';
            concerns.push(`Elevated AQI of ${aqi} detected`);
            recommendations.push('People with respiratory conditions should reduce outdoor activities.');
            recommendations.push('Consider wearing N95 masks when outdoors.');
        } else {
            airQualityAssessment = 'Air quality is unhealthy.';
            concerns.push(`High AQI of ${aqi} - health alert in effect`);
            recommendations.push('Avoid outdoor activities. Keep windows closed.');
            recommendations.push('Use air purifiers indoors if available.');
            recommendations.push('Seek medical attention if experiencing respiratory symptoms.');
        }

        // Analyze temperature
        let tempAssessment = '';
        if (temp > 35) {
            tempAssessment = `High temperature of ${temp}°C recorded.`;
            concerns.push('Heat advisory conditions');
            recommendations.push('Stay hydrated and avoid prolonged sun exposure.');
            recommendations.push('Check on elderly neighbors and vulnerable individuals.');
        } else if (temp < 10) {
            tempAssessment = `Low temperature of ${temp}°C recorded.`;
            recommendations.push('Dress warmly in layers when going outside.');
        } else {
            tempAssessment = `Temperature is comfortable at ${temp}°C.`;
        }

        // Analyze water quality
        let waterAssessment = '';
        if (ph < 6.5) {
            waterAssessment = 'Water pH is below normal range (acidic).';
            concerns.push(`Low water pH of ${ph} detected`);
            recommendations.push('Avoid direct use of municipal water for drinking without treatment.');
        } else if (ph > 8.5) {
            waterAssessment = 'Water pH is above normal range (alkaline).';
            concerns.push(`High water pH of ${ph} detected`);
        } else {
            waterAssessment = 'Water quality parameters are within normal range.';
        }

        // Add general recommendations if list is short
        if (recommendations.length < 2) {
            if (humidity > 70) {
                recommendations.push('High humidity detected. Use dehumidifiers to prevent mold growth indoors.');
            }
            if (parseFloat(sensorData.weather.uvIndex) > 6) {
                recommendations.push('High UV index. Apply sunscreen and wear protective clothing outdoors.');
            }
            recommendations.push('Continue monitoring environmental conditions for any changes.');
        }

        const summary = `${airQualityAssessment} ${tempAssessment} ${waterAssessment}`;
        
        const prediction = this.generatePrediction(sensorData);

        return {
            summary: summary.trim(),
            concerns,
            recommendations: recommendations.slice(0, 4),
            prediction
        };
    }

    generatePrediction(sensorData) {
        const hour = new Date().getHours();
        const aqi = sensorData.air.aqi;
        
        let prediction = '';
        
        if (hour >= 6 && hour < 12) {
            prediction = 'Air quality may worsen during afternoon rush hours. ';
            if (aqi > 100) {
                prediction += 'Recommend completing outdoor activities in the morning.';
            } else {
                prediction += 'Conditions expected to remain stable until evening.';
            }
        } else if (hour >= 12 && hour < 18) {
            prediction = 'Peak pollution levels typically occur in late afternoon. ';
            prediction += 'Expect gradual improvement after 8 PM.';
        } else {
            prediction = 'Overnight conditions expected to bring improved air quality. ';
            prediction += 'Morning readings should show better environmental metrics.';
        }
        
        return prediction;
    }

    // Specific analysis for anomaly events
    async analyzeAnomaly(anomaly, context) {
        if (!this.isConfigured) {
            return this.getOfflineAnomalyAnalysis(anomaly);
        }

        const prompt = `Analyze this environmental anomaly and provide immediate response recommendations:

ANOMALY DETECTED:
- Type: ${anomaly.type}
- Severity: ${anomaly.severity}
- Details: ${anomaly.message}
- Value: ${anomaly.value}
- Normal Threshold: ${anomaly.threshold}

Provide:
1. What this anomaly likely indicates
2. Immediate actions to take
3. Who should be notified
4. Expected duration/pattern

Keep response concise and actionable.`;

        try {
            const response = await this.callGeminiAPI(prompt);
            return response;
        } catch (error) {
            return this.getOfflineAnomalyAnalysis(anomaly);
        }
    }

    getOfflineAnomalyAnalysis(anomaly) {
        const analyses = {
            air: {
                critical: 'Critical air quality alert. Immediately notify health authorities and issue public warning. Recommend shelter-in-place for vulnerable populations. Expected to persist for 2-6 hours depending on weather conditions.',
                warning: 'Elevated air pollution detected. Monitor closely for further deterioration. Alert sensitive population groups. Consider issuing health advisory if conditions persist.'
            },
            water: {
                critical: 'Critical water quality issue detected. Immediately notify water utility and health department. Issue do-not-drink advisory until resolved. Deploy emergency water testing teams.',
                warning: 'Water quality anomaly detected. Increase monitoring frequency. Prepare to issue advisory if values continue to deviate. Check for potential contamination sources.'
            },
            weather: {
                critical: 'Extreme weather conditions detected. Activate emergency response protocols. Issue public safety warnings through all channels. Coordinate with emergency services.',
                warning: 'Weather advisory conditions present. Monitor for escalation. Prepare to issue warnings if conditions worsen. Alert outdoor event organizers.'
            }
        };

        return analyses[anomaly.type]?.[anomaly.severity] || 
            'Anomaly detected. Increase monitoring frequency and prepare response protocols.';
    }

    // Generate comprehensive report
    async generateReport(sensorData, historicalData, alerts) {
        const analysis = await this.analyzeEnvironmentalData(sensorData, historicalData);
        
        return {
            generatedAt: new Date().toISOString(),
            analysis,
            currentReadings: sensorData,
            recentAlerts: alerts.slice(0, 5),
            dataQuality: this.assessDataQuality(sensorData)
        };
    }

    assessDataQuality(sensorData) {
        // Simple data quality assessment
        const checks = {
            airData: sensorData.air && Object.keys(sensorData.air).length >= 5,
            weatherData: sensorData.weather && Object.keys(sensorData.weather).length >= 5,
            waterData: sensorData.water && Object.keys(sensorData.water).length >= 4
        };

        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;

        return {
            score: Math.round((passed / total) * 100),
            status: passed === total ? 'Good' : passed >= 2 ? 'Partial' : 'Poor',
            checks
        };
    }
}

export default GeminiAI;
