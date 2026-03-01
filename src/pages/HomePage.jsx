import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import '../styles/home.css';

export default function HomePage() {
    useEffect(() => {
        const handleScroll = () => {
            const navbar = document.querySelector('.navbar');
            if (navbar) {
                navbar.classList.toggle('scrolled', window.scrollY > 50);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <nav className="navbar">
                <div className="nav-container">
                    <Link to="/" className="nav-logo">
                        <div className="logo-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <span className="logo-text">EcoMonitor</span>
                    </Link>
                    <div className="nav-links">
                        <a href="#features">Features</a>
                        <a href="#how-it-works">How It Works</a>
                        <a href="#benefits">Benefits</a>
                        <a href="#contact">Contact</a>
                    </div>
                    <div className="nav-actions">
                        <Link to="/login" className="btn btn-ghost">Login</Link>
                        <Link to="/signup" className="btn btn-primary">Get Started</Link>
                    </div>
                </div>
            </nav>

            <section className="hero">
                <div className="hero-bg"><div className="hero-gradient"></div><div className="hero-particles"></div></div>
                <div className="hero-content">
                    <div className="hero-badge"><span className="badge-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span><span>Climate Tech Innovation</span></div>
                    <h1 className="hero-title">Real-Time Environmental <span className="gradient-text">Intelligence Platform</span></h1>
                    <p className="hero-subtitle">Monitor air quality, water safety, and weather conditions with AI-powered insights. Protect your community with automated alerts and data-driven decisions.</p>
                    <div className="hero-cta">
                        <Link to="/signup" className="btn btn-primary btn-large"><span>Start Monitoring Free</span></Link>
                        <a href="#features" className="btn btn-outline btn-large"><span>Explore Features</span></a>
                    </div>
                    <div className="hero-stats">
                        <div className="stat-item"><span className="stat-number">50+</span><span className="stat-label">Sensor Types</span></div>
                        <div className="stat-divider"></div>
                        <div className="stat-item"><span className="stat-number">24/7</span><span className="stat-label">Monitoring</span></div>
                        <div className="stat-divider"></div>
                        <div className="stat-item"><span className="stat-number">AI</span><span className="stat-label">Powered</span></div>
                    </div>
                </div>
                <div className="hero-image">
                    <div className="dashboard-preview">
                        <div className="preview-header"><div className="preview-dots"><span></span><span></span><span></span></div><span className="preview-title">EcoMonitor Dashboard</span></div>
                        <div className="preview-content">
                            <div className="preview-card aqi"><span className="card-label">Air Quality</span><span className="card-value">42</span><span className="card-status good">Good</span></div>
                            <div className="preview-card temp"><span className="card-label">Temperature</span><span className="card-value">24°C</span><span className="card-status">Comfortable</span></div>
                            <div className="preview-card water"><span className="card-label">Water pH</span><span className="card-value">7.2</span><span className="card-status good">Safe</span></div>
                            <div className="preview-chart"><div className="chart-bars"><div className="bar" style={{height:'60%'}}></div><div className="bar" style={{height:'45%'}}></div><div className="bar" style={{height:'70%'}}></div><div className="bar" style={{height:'55%'}}></div><div className="bar" style={{height:'80%'}}></div><div className="bar" style={{height:'65%'}}></div><div className="bar" style={{height:'50%'}}></div></div></div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="features" id="features">
                <div className="container">
                    <div className="section-header">
                        <span className="section-badge">Features</span>
                        <h2 className="section-title">Everything You Need for Environmental Monitoring</h2>
                        <p className="section-subtitle">Comprehensive tools to track, analyze, and respond to environmental conditions in real-time</p>
                    </div>
                    <div className="features-grid">
                        {[
                            { cls: 'air', title: 'Air Quality Monitoring', desc: 'Track AQI, PM2.5, PM10, O₃, NO₂, SO₂, and CO levels with real-time updates and historical trends.', items: ['Real-time AQI calculations', 'Pollutant breakdown analysis', 'Health impact assessments'], icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.7 7.7a7.5 7.5 0 1 0-10.6 10.6"/><path d="M8 16h.01"/><path d="M12 12h.01"/><path d="M16 8h.01"/><path d="M20 4h.01"/></svg> },
                            { cls: 'water', title: 'Water Quality Analysis', desc: 'Monitor pH levels, dissolved oxygen, turbidity, TDS, and conductivity for safe water assurance.', items: ['Multi-parameter testing', 'Contamination alerts', 'Safe drinking indicators'], icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg> },
                            { cls: 'weather', title: 'Weather Tracking', desc: 'Get temperature, humidity, pressure, wind speed, UV index, and weather forecasts for any location.', items: ['24-hour forecasts', 'Severe weather alerts', 'Global location search'], icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> },
                            { cls: 'ai', title: 'AI-Powered Insights', desc: 'Leverage Gemini AI for intelligent analysis, anomaly detection, and actionable recommendations.', items: ['Trend predictions', 'Anomaly detection', 'Health recommendations'], icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 22"/><path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93"/><path d="M4 13h16"/><path d="M6 17h12"/></svg> },
                            { cls: 'alerts', title: 'Automated Alerts', desc: 'Receive instant notifications via email when environmental conditions exceed safe thresholds.', items: ['Customizable thresholds', 'Email notifications', 'Emergency protocols'], icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
                            { cls: 'data', title: 'Data Visualization', desc: 'Beautiful charts and graphs to visualize trends, compare data, and make informed decisions.', items: ['Interactive charts', 'Export reports', 'Historical analysis'], icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
                        ].map(f => (
                            <div key={f.cls} className="feature-card">
                                <div className={`feature-icon ${f.cls}`}>{f.icon}</div>
                                <h3>{f.title}</h3>
                                <p>{f.desc}</p>
                                <ul className="feature-list">{f.items.map(item => <li key={item}>{item}</li>)}</ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="how-it-works" id="how-it-works">
                <div className="container">
                    <div className="section-header">
                        <span className="section-badge">How It Works</span>
                        <h2 className="section-title">Get Started in Minutes</h2>
                        <p className="section-subtitle">Simple setup process to start monitoring your environment</p>
                    </div>
                    <div className="steps-grid">
                        <div className="step-card"><div className="step-number">01</div><h3>Create Account</h3><p>Sign up for free and set up your monitoring dashboard in seconds.</p></div>
                        <div className="step-connector"></div>
                        <div className="step-card"><div className="step-number">02</div><h3>Configure Sensors</h3><p>Connect your IoT sensors or use our simulated data to explore features.</p></div>
                        <div className="step-connector"></div>
                        <div className="step-card"><div className="step-number">03</div><h3>Monitor & Protect</h3><p>View real-time data, receive alerts, and protect your community.</p></div>
                    </div>
                </div>
            </section>

            <section className="benefits" id="benefits">
                <div className="container">
                    <div className="benefits-content">
                        <div className="benefits-text">
                            <span className="section-badge">Why EcoMonitor?</span>
                            <h2 className="section-title">Built for Communities That Care</h2>
                            <p className="section-subtitle">Whether you&apos;re an environmental agency, urban planner, or concerned citizen, EcoMonitor provides the tools you need.</p>
                            <ul className="benefits-list">
                                {['Open Source & Free', 'Privacy First', 'Easy Integration', 'Global Coverage'].map(b => (
                                    <li key={b}><div className="benefit-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg></div><div className="benefit-content"><h4>{b}</h4></div></li>
                                ))}
                            </ul>
                        </div>
                        <div className="benefits-image">
                            <div className="benefits-card"><div className="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28"><path d="M12 22c4-4 8-7.5 8-12a8 8 0 1 0-16 0c0 4.5 4 8 8 12z"/><path d="M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M7 15l2-2"/><path d="M15 15l-2-2"/></svg></div><h4>For Urban Residents</h4><p>Know when it&apos;s safe to exercise outdoors or when to keep windows closed.</p></div>
                            <div className="benefits-card"><div className="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M9 17h1"/></svg></div><h4>For Environmental Agencies</h4><p>Monitor compliance, track trends, and make data-driven policy decisions.</p></div>
                            <div className="benefits-card"><div className="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div><h4>For Healthcare</h4><p>Correlate health data with environmental factors for better patient outcomes.</p></div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="cta-section">
                <div className="container">
                    <div className="cta-content">
                        <h2>Ready to Protect Your Community?</h2>
                        <p>Join thousands of users monitoring environmental conditions worldwide.</p>
                        <div className="cta-buttons">
                            <Link to="/signup" className="btn btn-primary btn-large"><span>Get Started Free</span></Link>
                            <Link to="/dashboard" className="btn btn-ghost btn-large"><span>View Demo Dashboard</span></Link>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="footer" id="contact">
                <div className="container">
                    <div className="footer-grid">
                        <div className="footer-brand">
                            <Link to="/" className="footer-logo"><span>EcoMonitor</span></Link>
                            <p>Open-source environmental monitoring platform for climate-aware communities.</p>
                        </div>
                        <div className="footer-links"><h4>Product</h4><ul><li><a href="#features">Features</a></li><li><Link to="/dashboard">Dashboard</Link></li></ul></div>
                        <div className="footer-links"><h4>Resources</h4><ul><li><a href="#">Documentation</a></li><li><a href="#">API Reference</a></li></ul></div>
                        <div className="footer-links"><h4>Legal</h4><ul><li><a href="#">Privacy Policy</a></li><li><a href="#">Terms of Service</a></li></ul></div>
                    </div>
                    <div className="footer-bottom"><p>&copy; 2026 EcoMonitor. Open Source under MIT License.</p></div>
                </div>
            </footer>
        </>
    );
}
