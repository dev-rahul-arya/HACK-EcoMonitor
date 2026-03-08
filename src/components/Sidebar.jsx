import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
    const { connected, lastSyncTime, unreadAlertCount } = useApp();
    const { logout } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const navigate = useNavigate();

    const navItems = [
        { to: '/dashboard', label: 'Dashboard', icon: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></> },
        { to: '/dashboard/air-quality', label: 'Air Quality', icon: <path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" /> },
        { to: '/dashboard/water-quality', label: 'Water Quality', icon: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /> },
        { to: '/dashboard/weather', label: 'Weather', icon: <><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /><circle cx="12" cy="12" r="4" /></> },
        { to: '/dashboard/alerts', label: 'Alerts', badge: unreadAlertCount, icon: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></> },
        { to: '/dashboard/ai-insights', label: 'AI Insights', icon: <><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" /><path d="M16 14v6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6" /><circle cx="12" cy="6" r="1" /></> },
        { to: '/dashboard/climate-trends', label: 'Climate Trends', icon: <><path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 4-6" /></> },
    ];

    return (
        <>
            <button className="menu-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
            </button>
            <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
                        <svg className="logo-icon" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2" />
                            <path d="M20 8C20 8 12 14 12 22C12 26.4183 15.5817 30 20 30C24.4183 30 28 26.4183 28 22C28 14 20 8 20 8Z" fill="currentColor" opacity="0.3" />
                            <path d="M20 12V28M14 20H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <div className="logo-text">
                            <span className="logo-name">EcoMonitor</span>
                            <span className="logo-tagline">Environmental Intelligence</span>
                        </div>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    <ul className="nav-list">
                        {navItems.map(item => (
                            <li key={item.to} className="nav-item-wrapper">
                                <NavLink
                                    to={item.to}
                                    end={item.to === '/dashboard'}
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    onClick={() => setMobileOpen(false)}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        {item.icon}
                                    </svg>
                                    <span>{item.label}</span>
                                    {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="sidebar-footer">
                    <div className="connection-status">
                        <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
                        <span className="status-text">{connected ? 'Connected' : 'Offline'}</span>
                    </div>
                    <div className="last-update">
                        <span>Last sync: </span>
                        <span>{lastSyncTime}</span>
                    </div>
                    <button
                        className="sign-out-btn"
                        onClick={async () => { await logout(); navigate('/'); }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>
            {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
        </>
    );
}
