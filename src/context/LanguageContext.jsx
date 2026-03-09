import { createContext, useContext, useState, useCallback } from 'react';
import translations from '../modules/translations';

const LanguageContext = createContext(null);

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
    return ctx;
}

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState(() => {
        try { return localStorage.getItem('eco_language') || 'en'; } catch { return 'en'; }
    });

    const setLanguage = useCallback((code) => {
        setLang(code);
        try { localStorage.setItem('eco_language', code); } catch { /* storage unavailable */ }
    }, []);

    const t = useCallback((key) => {
        return translations[lang]?.[key] || translations.en?.[key] || key;
    }, [lang]);

    return (
        <LanguageContext.Provider value={{ lang, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}
