import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
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

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route
                        path="/dashboard"
                        element={
                            <AppProvider>
                                <DashboardLayout />
                            </AppProvider>
                        }
                    >
                        <Route index element={<DashboardView />} />
                        <Route path="air-quality" element={<AirQualityView />} />
                        <Route path="water-quality" element={<WaterQualityView />} />
                        <Route path="weather" element={<WeatherView />} />
                        <Route path="alerts" element={<AlertsView />} />
                        <Route path="ai-insights" element={<AIInsightsView />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}
