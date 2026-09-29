-- ==============================================================================
-- DEFINITIVE FIX FOR "Database error querying schema"
-- ==============================================================================
-- This fixes BOTH causes:
-- 1. NULL token columns in auth.users (fixes GoTrue Go scan error)
-- 2. Recursive RLS policy on public.profiles
-- 3. Creates founder@ekodrix.com with all required non-null fields
-- ==============================================================================

-- 1. Fix NULL token columns for ALL users in auth.users
UPDATE auth.users
SET 
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    email_confirmed_at = COALESCE(email_confirmed_at, now());

-- 2. Fix the infinite recursion on public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles Self View" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Admin Write" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin All Access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;

-- Allow all authenticated users to read profiles without function recursion
CREATE POLICY "Allow authenticated to read profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Allow service role / triggers full access
CREATE POLICY "Service role full access on profiles" ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. Update is_admin() and is_founder_or_admin() helper functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_founder_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'founder', 'co-founder')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Cleanly recreate / update founder@ekodrix.com with all required tokens
DELETE FROM auth.users WHERE email = 'founder@ekodrix.com';

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone_change,
    phone_change_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'founder@ekodrix.com',
    crypt('Founder@Ekodrix2026!', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Ekodrix Founder"}',
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    ''
);

-- Ensure profile exists with role 'founder'
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, 'founder@ekodrix.com', 'Ekodrix Founder', 'founder'
FROM auth.users
WHERE email = 'founder@ekodrix.com'
ON CONFLICT (id) DO UPDATE
SET role = 'founder', email = 'founder@ekodrix.com', full_name = 'Ekodrix Founder';

-- Ensure admin account has 'admin' role
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@ekodrix.com';
