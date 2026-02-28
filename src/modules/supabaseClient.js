/**
 * Singleton Supabase Client
 * ─────────────────────────
 * Every module (AuthContext, SupabaseService, pages) must import from HERE
 * so they all share the **same** GoTrueClient (auth) and the same
 * Authorization header.  Creating multiple createClient() instances is
 * the #1 cause of "RLS returns empty / 403" bugs because each instance
 * manages its own in-memory session token independently.
 *
 * Environment variables (Vite exposes VITE_* via import.meta.env):
 *   VITE_SUPABASE_URL      – e.g. https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY – the anon/public key from Supabase dashboard
 *
 * Put them in a .env file at the project root (already gitignored).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const hasSupabaseConfig = Boolean(
    supabaseUrl && supabaseAnonKey &&
    supabaseUrl.length > 10 && supabaseAnonKey.length > 10
);

/**
 * The one-and-only Supabase client for this app.
 * `null` when env vars are missing (local-dev fallback mode).
 */
export const supabase = hasSupabaseConfig
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
