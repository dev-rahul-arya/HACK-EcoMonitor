import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { LanguageProvider } from './context/LanguageContext';
import DashboardLayout from './layouts/DashboardLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardView from './pages/DashboardView';
import AirQualityView from './pages/AirQualityView';
import WaterQualityView from './pages/WaterQualityView';
import WeatherView from './pages/WeatherView';
import AlertsView from './pages/AlertsView';
import AIInsightsView from './pages/AIInsightsView';
import ClimateTrendsView from './pages/ClimateTrendsView';

function RequireAuth({ children }) {
    const { user, loading, authEnabled } = useAuth();
    const location = useLocation();

    if (!authEnabled) return children;
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
    return children;
}

function RedirectIfAuth({ children }) {
    const { user, loading, authEnabled } = useAuth();

    if (!authEnabled) return children;
    if (loading) return null;
    if (user) return <Navigate to="/dashboard" replace />;
    return children;
}

export default function App() {
    return (
        <LanguageProvider>
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
                    <Route path="/signup" element={<RedirectIfAuth><SignupPage /></RedirectIfAuth>} />
                    <Route
                        path="/dashboard"
                        element={
                            <RequireAuth>
                                <AppProvider>
                                    <DashboardLayout />
                                </AppProvider>
                            </RequireAuth>
                        }
                    >
                        <Route index element={<DashboardView />} />
                        <Route path="air-quality" element={<AirQualityView />} />
                        <Route path="water-quality" element={<WaterQualityView />} />
                        <Route path="weather" element={<WeatherView />} />
                        <Route path="alerts" element={<AlertsView />} />
                        <Route path="ai-insights" element={<AIInsightsView />} />
                        <Route path="climate-trends" element={<ClimateTrendsView />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
        </LanguageProvider>
    );
}
