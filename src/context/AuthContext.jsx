import { createContext, useContext, useState, useCallback } from 'react';
import CONFIG from '../modules/config';

const AuthContext = createContext(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [supabase, setSupabase] = useState(null);
    const [loading, setLoading] = useState(false);

    const getClient = useCallback(async () => {
        if (supabase) return supabase;
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const client = createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.ANON_KEY);
            setSupabase(client);
            return client;
        } catch {
            return null;
        }
    }, [supabase]);

    const login = useCallback(async (email, password) => {
        setLoading(true);
        try {
            const client = await getClient();
            if (!client) throw new Error('Authentication service not available');
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            setUser(data.user);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    }, [getClient]);

    const signup = useCallback(async (email, password, metadata) => {
        setLoading(true);
        try {
            const client = await getClient();
            if (!client) throw new Error('Authentication service not available');
            const { data, error } = await client.auth.signUp({ email, password, options: { data: metadata } });
            if (error) throw error;
            if (data.user?.identities?.length === 0) {
                return { success: false, error: 'An account with this email already exists.' };
            }
            return { success: true, message: 'Account created! Please check your email to verify your account.' };
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    }, [getClient]);

    const signInWithProvider = useCallback(async (provider) => {
        try {
            const client = await getClient();
            if (!client) throw new Error('Authentication service not available');
            const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [getClient]);

    const logout = useCallback(async () => {
        try {
            const client = await getClient();
            if (client) await client.auth.signOut();
            setUser(null);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }, [getClient]);

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, signInWithProvider, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
