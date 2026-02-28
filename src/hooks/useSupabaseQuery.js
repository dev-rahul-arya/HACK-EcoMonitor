/**
 * useSupabaseQuery
 * ────────────────
 * A lightweight React hook that fetches data from any Supabase table
 * through the shared singleton client.  Because auth + RLS is handled
 * transparently by the client, callers never need to attach tokens or
 * add .eq('user_id', …) filters — Supabase evaluates auth.uid() for
 * every query automatically.
 *
 * Usage:
 *   const { data, error, loading, refetch } = useSupabaseQuery(
 *     'sensor_readings',
 *     (query) => query
 *       .select('*')
 *       .gte('recorded_at', new Date(Date.now() - 86400000).toISOString())
 *       .order('recorded_at', { ascending: false })
 *       .limit(50)
 *   );
 *
 * IMPORTANT RLS pitfall:
 *   If the user is not authenticated, auth.uid() is NULL and every
 *   "USING (auth.uid() = user_id)" policy fails → the query returns
 *   an EMPTY array (not a 403 error).  Always check that the user is
 *   logged in before rendering data-dependent UI.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../modules/supabaseClient';

export default function useSupabaseQuery(table, buildQuery, deps = []) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        if (!supabase) {
            setError('Supabase not configured');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Start with supabase.from(table), then let caller shape the query
            let query = supabase.from(table).select('*');
            if (typeof buildQuery === 'function') {
                query = buildQuery(supabase.from(table));
            }

            const { data: rows, error: queryError } = await query;
            if (queryError) throw queryError;
            setData(rows);
        } catch (err) {
            console.error(`useSupabaseQuery(${table}):`, err);
            setError(err.message || 'Query failed');
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table, ...deps]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, error, loading, refetch: fetch };
}
