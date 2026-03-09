import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopHeader from '../components/TopHeader';
import ToastContainer from '../components/ToastContainer';
import { useLanguage } from '../context/LanguageContext';
import '../styles/style.css';

const viewMeta = {
    '/dashboard': { titleKey: 'dashboard', subtitleKey: 'dashboardSubtitle' },
    '/dashboard/air-quality': { titleKey: 'airQuality', subtitleKey: 'airQualitySubtitle' },
    '/dashboard/water-quality': { titleKey: 'waterQuality', subtitleKey: 'waterQualitySubtitle' },
    '/dashboard/weather': { titleKey: 'weather', subtitleKey: 'weatherSubtitle' },
    '/dashboard/alerts': { titleKey: 'alerts', subtitleKey: 'alertsSubtitle' },
    '/dashboard/ai-insights': { titleKey: 'aiInsights', subtitleKey: 'aiInsightsSubtitle' },
    '/dashboard/climate-trends': { titleKey: 'climateTrends', subtitleKey: 'climateTrendsSubtitle' },
};

export default function DashboardLayout() {
    const location = useLocation();
    const meta = viewMeta[location.pathname] || viewMeta['/dashboard'];
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { t } = useLanguage();

    return (
        <div className={`app-container ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
            <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)} />
            <main className="main-content">
                <TopHeader title={t(meta.titleKey)} subtitle={t(meta.subtitleKey)} />
                <div className="content-area">
                    <Outlet />
                </div>
            </main>
            <ToastContainer />
        </div>
    );
}
