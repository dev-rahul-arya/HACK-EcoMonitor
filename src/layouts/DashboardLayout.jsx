import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopHeader from '../components/TopHeader';
import ToastContainer from '../components/ToastContainer';
import '../styles/style.css';

const viewMeta = {
    '/dashboard': { title: 'Dashboard', subtitle: 'Real-time environmental overview' },
    '/dashboard/air-quality': { title: 'Air Quality', subtitle: 'Detailed air quality analysis' },
    '/dashboard/water-quality': { title: 'Water Quality', subtitle: 'Water safety monitoring' },
    '/dashboard/weather': { title: 'Weather', subtitle: 'Weather conditions & forecast' },
    '/dashboard/alerts': { title: 'Alerts', subtitle: 'Alert management center' },
    '/dashboard/ai-insights': { title: 'AI Insights', subtitle: 'AI-powered environmental analysis' },
};

export default function DashboardLayout() {
    const location = useLocation();
    const meta = viewMeta[location.pathname] || viewMeta['/dashboard'];

    return (
        <div className="app-container">
            <Sidebar />
            <main className="main-content">
                <TopHeader title={meta.title} subtitle={meta.subtitle} />
                <div className="content-area">
                    <Outlet />
                </div>
            </main>
            <ToastContainer />
        </div>
    );
}
