import { useMemo, useState, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const weatherIcons = {
    Clear: (
        <>
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </>
    ),
    'Partly Cloudy': (
        <>
            <path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M17.66 17.66l1.41 1.41M2 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            <circle cx="12" cy="10" r="4" />
            <path d="M8 16a4 4 0 0 1 8 0H8z" />
        </>
    ),
    Cloudy: <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />,
    Overcast: (
        <>
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            <path d="M4 14h2M18 14h2" />
        </>
    ),
    'Light Rain': (
        <>
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            <line x1="8" y1="21" x2="8" y2="23" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="16" y1="21" x2="16" y2="23" />
        </>
    ),
    Rain: (
        <>
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            <line x1="7" y1="21" x2="7" y2="24" /><line x1="11" y1="21" x2="11" y2="24" />
            <line x1="15" y1="21" x2="15" y2="24" /><line x1="19" y1="21" x2="19" y2="24" />
        </>
    ),
    Thunderstorm: (
        <>
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            <polyline points="13 21 11 15 15 15 13 9" />
        </>
    ),
    Fog: (
        <>
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="5" y1="14" x2="19" y2="14" />
            <line x1="7" y1="18" x2="17" y2="18" />
        </>
    ),
    Haze: (
        <>
            <circle cx="12" cy="12" r="4" opacity="0.5" />
            <line x1="3" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="21" y2="12" />
            <line x1="3" y1="16" x2="21" y2="16" />
            <line x1="5" y1="8" x2="19" y2="8" />
        </>
    ),
};

function getWeatherIcon(condition) {
    return weatherIcons[condition] || weatherIcons['Clear'];
}

function getWindDirectionDeg(dir) {
    const map = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
    return map[dir] ?? 0;
}

function getUVLevel(uv) {
    if (uv <= 2) return { label: 'Low', color: 'good' };
    if (uv <= 5) return { label: 'Moderate', color: 'moderate' };
    if (uv <= 7) return { label: 'High', color: 'warning' };
    if (uv <= 10) return { label: 'Very High', color: 'poor' };
    return { label: 'Extreme', color: 'poor' };
}

export default function WeatherView() {
    const { currentData, sensorsRef, historicalData, searchLocation } = useApp();
    const { t } = useLanguage();
    const [searchCity, setSearchCity] = useState('');
    const [realWeather, setRealWeather] = useState(null);
    const [searching, setSearching] = useState(false);

    const forecast = useMemo(() => {
        if (!sensorsRef.current) return [];
        return sensorsRef.current.generateForecast();
    }, [currentData]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearch = useCallback(async (e) => {
        if (e.key === 'Enter' && searchCity.trim()) {
            setSearching(true);
            try {
                const result = await searchLocation(searchCity.trim());
                if (result) {
                    setRealWeather(result);
                }
            } finally {
                setSearching(false);
            }
        }
    }, [searchCity, searchLocation]);

    const clearRealWeather = () => {
        setRealWeather(null);
        setSearchCity('');
    };

    // Temperature history chart
    const tempChartData = useMemo(() => ({
        labels: historicalData.timestamps.map(t => t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })),
        datasets: [{
            label: 'Temperature (°C)',
            data: historicalData.temperature,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.1)',
            tension: 0.4,
            fill: true,
        }]
    }), [historicalData]);

    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#9ca3af' } } },
        scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280' } }
        },
        interaction: { intersect: false, mode: 'index' }
    };

    if (!currentData) return <div className="view active"><p>{t('loading')}</p></div>;

    const w = realWeather ? null : currentData.weather;
    const rw = realWeather?.weather;
    const loc = realWeather?.location;

    const displayTemp = rw ? Math.round(rw.temperature_2m) : Math.round(parseFloat(w.temperature));
    const displayHumidity = rw ? rw.relative_humidity_2m : w.humidity;
    const displayWind = rw ? rw.wind_speed_10m?.toFixed(1) : w.windSpeed;
    const displayPressure = rw ? Math.round(rw.pressure_msl) : w.pressure;
    const displayUV = rw ? rw.uv_index : w.uvIndex;
    const displayCondition = rw ? getWMOCondition(rw.weather_code) : w.condition;
    const displayLocation = loc ? `${loc.name}, ${loc.country}` : t('currentLocation');
    const displayVisibility = w ? `${w.visibility} km` : '--';
    const displayWindDir = w ? w.windDirection : 'N';

    const uvLevel = getUVLevel(displayUV);

    const weatherDetails = [
        {
            label: t('humidity'), value: `${displayHumidity}%`,
            icon: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
        },
        {
            label: t('windSpeed'), value: `${displayWind} km/h ${displayWindDir}`,
            icon: <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />,
            extra: (
                <div className="wind-direction-indicator" style={{ transform: `rotate(${getWindDirectionDeg(displayWindDir)}deg)` }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width:16,height:16}}>
                        <path d="M12 2l3 8H9l3-8z" />
                    </svg>
                </div>
            ),
        },
        {
            label: t('pressure'), value: `${displayPressure} hPa`,
            icon: <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>,
        },
        {
            label: t('uvIndex'), value: `${displayUV}`,
            icon: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>,
            badge: <span className={`uv-badge ${uvLevel.color}`}>{uvLevel.label}</span>,
        },
        {
            label: t('visibility'), value: displayVisibility,
            icon: <><circle cx="12" cy="12" r="3" /><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /></>,
        },
        {
            label: t('feelsLike'), value: rw ? `${Math.round(rw.apparent_temperature)}°C` : `${Math.round(parseFloat(w.temperature) - 2 + Math.random() * 4)}°C`,
            icon: <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />,
        },
    ];

    // Weather warnings based on conditions
    const warnings = [];
    if (displayUV >= 8) warnings.push({ text: `Very High UV Index (${displayUV}) - Wear sunscreen and protective clothing`, severe: displayUV >= 11 });
    if (displayTemp >= 35) warnings.push({ text: `Heat Advisory - Temperature ${displayTemp}°C`, severe: displayTemp >= 40 });
    if (displayTemp <= 0) warnings.push({ text: `Frost Warning - Temperature ${displayTemp}°C`, severe: displayTemp <= -5 });
    if (parseFloat(displayWind) >= 25) warnings.push({ text: `High Wind Advisory - ${displayWind} km/h`, severe: parseFloat(displayWind) >= 40 });
    if (displayCondition === 'Thunderstorm') warnings.push({ text: 'Thunderstorm Warning - Seek shelter immediately', severe: true });

    return (
        <section className="view active" id="view-weather">
            <div className="view-content">
                {/* City Search */}
                <div className="weather-search-bar">
                    <div className="weather-search-input">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder={t('searchCityWeather')}
                            value={searchCity}
                            onChange={e => setSearchCity(e.target.value)}
                            onKeyDown={handleSearch}
                            disabled={searching}
                        />
                        {searching && <div className="search-spinner"></div>}
                    </div>
                    {realWeather && (
                        <button className="btn-secondary" onClick={clearRealWeather}>
                            {t('backToSimulated')}
                        </button>
                    )}
                </div>

                {/* Data Source Badge */}
                {realWeather && (
                    <div className="weather-source-badge live">
                        <span className="source-dot"></span>
                        {t('liveData')}
                    </div>
                )}
                {!realWeather && (
                    <div className="weather-source-badge simulated">
                        <span className="source-dot"></span>
                        {t('simulatedData')}
                    </div>
                )}

                {/* Main Weather Display */}
                <div className="weather-main">
                    <div className="current-weather">
                        <div className="weather-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                {getWeatherIcon(displayCondition)}
                            </svg>
                        </div>
                        <div className="weather-temp">
                            <span className="temp-value">{displayTemp}</span>
                            <span className="temp-unit">°C</span>
                        </div>
                        <div className="weather-condition">{displayCondition}</div>
                        <div className="weather-location">{displayLocation}</div>
                    </div>
                    <div className="weather-details">
                        {weatherDetails.map(d => (
                            <div key={d.label} className="weather-detail-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{d.icon}</svg>
                                <div className="detail-info">
                                    <span className="detail-label">{d.label}</span>
                                    <div className="detail-value-row">
                                        <span className="detail-value">{d.value}</span>
                                        {d.badge}
                                        {d.extra}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Weather Warnings */}
                {warnings.length > 0 && (
                    <div className="weather-alerts">
                        <h3>{t('weatherWarnings')}</h3>
                        <div className="warning-list">
                            {warnings.map((w, i) => (
                                <div key={i} className={`warning-item ${w.severe ? 'severe' : ''}`}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                    <span className="warning-text">{w.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 24-Hour Forecast (simulated only) */}
                {!realWeather && (
                    <div className="forecast-section">
                        <h3>{t('hourForecast')}</h3>
                        <div className="forecast-scroll">
                            {forecast.map((item, i) => (
                                <div key={i} className="forecast-item">
                                    <span className="forecast-time">{item.time.toLocaleTimeString('en-US', { hour: 'numeric' })}</span>
                                    <div className="forecast-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            {getWeatherIcon(item.condition)}
                                        </svg>
                                    </div>
                                    <span className="forecast-temp">{item.temperature}°</span>
                                    {item.precipitation > 0 && (
                                        <span className="forecast-precip">{item.precipitation}%</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Temperature History Chart */}
                {!realWeather && historicalData.temperature.length > 0 && (
                    <div className="chart-card full-width">
                        <div className="card-header"><h3>{t('temperatureHistory')}</h3></div>
                        <div className="chart-container"><Line data={tempChartData} options={chartOptions} /></div>
                    </div>
                )}
            </div>
        </section>
    );
}

/** Map WMO weather codes to condition names */
function getWMOCondition(code) {
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 49) return 'Fog';
    if (code <= 59) return 'Light Rain';
    if (code <= 69) return 'Rain';
    if (code <= 79) return 'Rain';
    if (code <= 84) return 'Rain';
    if (code <= 94) return 'Rain';
    if (code >= 95) return 'Thunderstorm';
    return 'Cloudy';
}
