import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

export default function TopHeader({ title, subtitle }) {
    const { refreshData, unreadAlertCount, searchLocation, searchedLocation } = useApp();
    const [searchValue, setSearchValue] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const navigate = useNavigate();

    const handleSearch = (e) => {
        if (e.key === 'Enter' && searchValue.trim()) {
            searchLocation(searchValue.trim());
        }
    };

    const handleRefresh = useCallback(async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            await refreshData();
        } finally {
            setTimeout(() => setRefreshing(false), 800);
        }
    }, [refreshing, refreshData]);

    return (
        <header className="top-header">
            <div className="header-left">
                <div className="page-title">
                    <h1>{title}</h1>
                    <p className="page-subtitle">{subtitle}</p>
                </div>
            </div>
            <div className="header-right">
                <div className="search-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder={searchedLocation ? `Current: ${searchedLocation}` : 'Search city to update all data...'}
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onKeyDown={handleSearch}
                    />
                </div>
                <div className="header-actions">
                    <button
                        className={`action-btn ${refreshing ? 'spinning' : ''}`}
                        title="Refresh Data"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                    </button>
                    <button className="action-btn notification-btn" title="Notifications" onClick={() => navigate('/dashboard/alerts')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        {unreadAlertCount > 0 && <span className="notification-indicator active"></span>}
                    </button>
                </div>
            </div>
        </header>
    );
}
