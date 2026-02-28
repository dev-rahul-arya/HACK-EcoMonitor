import { useState, useCallback } from 'react';
import CONFIG from '../modules/config';

/**
 * useClimateAnalysis
 * ──────────────────
 * Calls POST /api/analyze-climate on the Express backend.
 * The backend computes stats from CSV (instant), builds a compact digest,
 * then sends only ~500 chars to Gemini for narrative analysis.
 *
 * Returns:
 *   analysis  — Markdown narrative from Gemini (or offline fallback)
 *   stats     — Pre-computed statistics object (for charts/chips)
 *   meta      — Request metadata
 *   loading   — Boolean
 *   error     — Error message or null
 */
export default function useClimateAnalysis() {
    const [analysis, setAnalysis] = useState(null);
    const [stats, setStats] = useState(null);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const analyze = useCallback(async (startYear, endYear) => {
        setLoading(true);
        setError(null);
        setAnalysis(null);
        setStats(null);
        setMeta(null);

        try {
            const res = await fetch(`${CONFIG.BACKEND.API_URL}/api/analyze-climate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startYear: +startYear, endYear: +endYear }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Server error ${res.status}`);
            }

            const data = await res.json();
            setAnalysis(data.analysis);
            setStats(data.stats || null);
            setMeta(data.meta);
            return data;
        } catch (err) {
            setError(err.message || 'Failed to analyze climate data');
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setAnalysis(null);
        setStats(null);
        setMeta(null);
        setError(null);
    }, []);

    return { analysis, stats, meta, loading, error, analyze, reset };
}
