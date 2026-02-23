import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export default function WeatherView() {
    const { currentData, sensorsRef } = useApp();

    const forecast = useMemo(() => {
        if (!sensorsRef.current) return [];
        return sensorsRef.current.generateForecast().slice(0, 12);
    }, [currentData]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!currentData) return <div className="view active"><p>Loading...</p></div>;

    const weatherDetails = [
        { label: 'Humidity', value: `${currentData.weather.humidity}%`, icon: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /> },
        { label: 'Wind Speed', value: `${currentData.weather.windSpeed} km/h`, icon: <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" /> },
        { label: 'Pressure', value: `${currentData.weather.pressure} hPa`, icon: <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></> },
        { label: 'UV Index', value: currentData.weather.uvIndex, icon: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></> },
    ];

    return (
        <section className="view active" id="view-weather">
            <div className="view-content">
                <div className="weather-main">
                    <div className="current-weather">
                        <div className="weather-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        </div>
                        <div className="weather-temp">
                            <span className="temp-value">{Math.round(currentData.weather.temperature)}</span>
                            <span className="temp-unit">°C</span>
                        </div>
                        <div className="weather-condition">{currentData.weather.condition}</div>
                        <div className="weather-location">Current Location</div>
                    </div>
                    <div className="weather-details">
                        {weatherDetails.map(d => (
                            <div key={d.label} className="weather-detail-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{d.icon}</svg>
                                <div className="detail-info">
                                    <span className="detail-label">{d.label}</span>
                                    <span className="detail-value">{d.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="forecast-section">
                    <h3>24-Hour Forecast</h3>
                    <div className="forecast-scroll" style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
                        {forecast.map((item, i) => (
                            <div key={i} className="forecast-item">
                                <span className="forecast-time">{item.time.toLocaleTimeString('en-US', { hour: 'numeric' })}</span>
                                <div className="forecast-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                                    </svg>
                                </div>
                                <span className="forecast-temp">{item.temperature}°</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
