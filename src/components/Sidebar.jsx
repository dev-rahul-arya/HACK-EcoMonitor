import { useState, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Sidebar({ collapsed, onToggleCollapse }) {
    const { connected, lastSyncTime, supabaseStatus, refreshSupabaseStatus } = useApp();
    const { logout } = useAuth();
    const { t } = useLanguage();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showSupabaseInfo, setShowSupabaseInfo] = useState(false);
    const [supabaseRefreshing, setSupabaseRefreshing] = useState(false);
    const navigate = useNavigate();

    const handleRefreshSupabase = useCallback(async () => {
        if (supabaseRefreshing) return;
        setSupabaseRefreshing(true);
        try { await refreshSupabaseStatus(); }
        finally { setTimeout(() => setSupabaseRefreshing(false), 800); }
    }, [supabaseRefreshing, refreshSupabaseStatus]);

    const navItems = [
        { to: '/dashboard', labelKey: 'dashboard', icon: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></> },
        { to: '/dashboard/air-quality', labelKey: 'airQuality', icon: <path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" /> },
        { to: '/dashboard/water-quality', labelKey: 'waterQuality', icon: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /> },
        { to: '/dashboard/weather', labelKey: 'weather', icon: <><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /><circle cx="12" cy="12" r="4" /></> },
        { to: '/dashboard/alerts', labelKey: 'alerts', icon: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></> },
        { to: '/dashboard/ai-insights', labelKey: 'aiInsights', icon: <><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" /><path d="M16 14v6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6" /><circle cx="12" cy="6" r="1" /></> },
        { to: '/dashboard/climate-trends', labelKey: 'climateTrends', icon: <><path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 4-6" /></> },
    ];

    return (
        <>
            <button className="menu-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
            </button>
            <aside className={`sidebar ${mobileOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
                        <svg className="logo-icon" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2" />
                            <path d="M20 8C20 8 12 14 12 22C12 26.4183 15.5817 30 20 30C24.4183 30 28 26.4183 28 22C28 14 20 8 20 8Z" fill="currentColor" opacity="0.3" />
                            <path d="M20 12V28M14 20H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        {!collapsed && (
                            <div className="logo-text">
                                <span className="logo-name">EcoMonitor</span>
                                <span className="logo-tagline">{t('envIntelligence')}</span>
                            </div>
                        )}
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
                                    title={collapsed ? t(item.labelKey) : undefined}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        {item.icon}
                                    </svg>
                                    {!collapsed && <span>{t(item.labelKey)}</span>}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="sidebar-footer">
                    {!collapsed && (
                        <>
                            <div className="connection-status">
                                <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
                                <span className="status-text">{connected ? t('connected') : t('offline')}</span>
                                <button
                                    className="supabase-info-btn"
                                    onClick={() => setShowSupabaseInfo(!showSupabaseInfo)}
                                    title={t('supabaseStatus')}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                                    </svg>
                                </button>
                            </div>

                            {/* Supabase Info Popup */}
                            {showSupabaseInfo && (
                                <div className="supabase-popup">
                                    <div className="supabase-popup-header">
                                        <span>{t('supabaseStatus')}</span>
                                        <button
                                            className={`supabase-refresh-btn ${supabaseRefreshing ? 'spinning' : ''}`}
                                            onClick={handleRefreshSupabase}
                                            disabled={supabaseRefreshing}
                                            title={t('refreshData')}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                                        </button>
                                    </div>
                                    <div className="supabase-popup-grid">
                                        <div className="supabase-item">
                                            <span className="supabase-label">{t('configured')}</span>
                                            <span className={`supabase-value ${supabaseStatus?.configured ? 'yes' : 'no'}`}>{supabaseStatus?.configured ? t('yes') : t('no')}</span>
                                        </div>
                                        <div className="supabase-item">
                                            <span className="supabase-label">{t('connected')}</span>
                                            <span className={`supabase-value ${supabaseStatus?.connected ? 'yes' : 'no'}`}>{supabaseStatus?.connected ? t('yes') : t('no')}</span>
                                        </div>
                                        <div className="supabase-item">
                                            <span className="supabase-label">{t('authenticated')}</span>
                                            <span className={`supabase-value ${supabaseStatus?.auth ? 'yes' : 'no'}`}>{supabaseStatus?.auth ? t('yes') : t('no')}</span>
                                        </div>
                                        <div className="supabase-item">
                                            <span className="supabase-label">{t('tablesReady')}</span>
                                            <span className={`supabase-value ${supabaseStatus?.tablesExist ? 'yes' : 'no'}`}>{supabaseStatus?.tablesExist ? t('yes') : t('no')}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="last-update">
                                <span>{t('lastSync')}: </span>
                                <span>{lastSyncTime}</span>
                            </div>
                        </>
                    )}
                    <button
                        className="sign-out-btn"
                        onClick={async () => { await logout(); navigate('/'); }}
                        title={collapsed ? t('signOut') : undefined}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        {!collapsed && <span>{t('signOut')}</span>}
                    </button>
                </div>
                <button
                    className="sidebar-collapse-btn"
                    onClick={onToggleCollapse}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {collapsed
                            ? <polyline points="9 18 15 12 9 6" />
                            : <polyline points="15 18 9 12 15 6" />
                        }
                    </svg>
                </button>
            </aside>
            {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
        </>
    );
}
