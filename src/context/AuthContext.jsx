import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase, hasSupabaseConfig } from '../modules/supabaseClient';

const AuthContext = createContext(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

/**
 * AuthProvider
 * ────────────
 * Uses the **shared singleton** Supabase client from supabaseClient.js so that
 * every module (SupabaseService, pages, etc.) operates on the same auth session.
 *
 * Common pitfalls this avoids:
 *  1. Multiple createClient() instances each maintain their own in-memory session
 *     → RLS queries on the "other" client return empty/403.
 *  2. Lazy-initialising the client in a useCallback can miss the first
 *     onAuthStateChange event that fires synchronously.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    /* ── Bootstrap: restore session + subscribe to changes ── */
    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        let mounted = true;

        // 1. Restore any existing session (e.g. after page reload)
        supabase.auth.getSession().then(({ data }) => {
            if (mounted) {
                setSession(data.session ?? null);
                setUser(data.session?.user ?? null);
                setLoading(false);
            }
        });

        // 2. Listen for future changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, newSession) => {
                if (mounted) {
                    setSession(newSession ?? null);
                    setUser(newSession?.user ?? null);
                }
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    /* ── Auth actions ── */

    const login = useCallback(async (email, password) => {
        if (!supabase) return { success: false, error: 'Authentication service not available' };
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            // onAuthStateChange will update user/session automatically
            return { success: true, user: data.user, session: data.session };
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * signup
     * ──────
     * `metadata` is written into `raw_user_meta_data` on the auth.users row.
     * The DB trigger `handle_new_user()` reads it to populate the profiles table:
     *   { first_name, last_name, full_name, avatar_url }
     *
     * If any key is missing the corresponding column is simply NULL (all nullable).
     */
    const signup = useCallback(async (email, password, metadata = {}) => {
        if (!supabase) return { success: false, error: 'Authentication service not available' };
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: metadata },
            });
            if (error) throw error;

            // Supabase returns identities=[] when the email already exists (unconfirmed)
            if (data.user?.identities?.length === 0) {
                return { success: false, error: 'An account with this email already exists.' };
            }
            return {
                success: true,
                user: data.user,
                session: data.session,
                message: data.session
                    ? 'Account created! You are now signed in.'
                    : 'Account created! Please check your email to verify your account.',
            };
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    }, []);

    const signInWithProvider = useCallback(async (provider) => {
        if (!supabase) return { success: false, error: 'Authentication service not available' };
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: { redirectTo: window.location.origin + '/dashboard' },
            });
            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, []);

    const logout = useCallback(async () => {
        if (!supabase) return;
        try {
            await supabase.auth.signOut();
            // onAuthStateChange will set user/session to null
        } catch (error) {
            console.error('Logout error:', error);
        }
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                loading,
                authEnabled: hasSupabaseConfig,
                login,
                signup,
                signInWithProvider,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
