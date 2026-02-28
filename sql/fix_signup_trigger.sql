-- ============================================
-- FIX: "Database error saving new user"
-- ============================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- Root cause: The SECURITY DEFINER trigger functions don't set
-- search_path = public, so Postgres can't find the profiles /
-- user_settings tables when the trigger fires during signup.
-- Additionally, there's no ON CONFLICT handling for retried signups.
-- ============================================

-- 1. Fix the profile-creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public          -- ← THIS is the critical fix
AS $$
BEGIN
    INSERT INTO public.profiles (id, first_name, last_name, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data ->> 'first_name',
        NEW.raw_user_meta_data ->> 'last_name',
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        first_name  = EXCLUDED.first_name,
        last_name   = EXCLUDED.last_name,
        full_name   = EXCLUDED.full_name,
        avatar_url  = EXCLUDED.avatar_url,
        updated_at  = now();

    RETURN NEW;
END;
$$;

-- 2. Fix the settings-creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public          -- ← same fix
AS $$
BEGIN
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;   -- safe if row already exists

    RETURN NEW;
END;
$$;

-- 3. Re-attach triggers (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_settings();

-- 4. Quick verification — should return both function names
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_name IN ('handle_new_user', 'handle_new_user_settings');
