-- ==============================================================================
-- EKODRIX FINANCE: FOUNDER ROLE MIGRATION & SECURITY HARDENING
-- ==============================================================================
-- This script configures:
-- 1. Strict Role-Based Security: 'admin' (Full CRUD) vs 'founder' (Read-Only)
-- 2. HARD BLOCK on Salaries & Employees for Founder role (Row-Level Security)
-- 3. Read-Only access for Founders on Projects, Invoices, Payments, Expenses, Clients
-- 4. Creates / updates founder account: founder@ekodrix.com
-- ==============================================================================

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Update Role Checking Functions
-- Admin check: ONLY users with role = 'admin'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Founder or Admin check: users with role 'admin', 'founder', or 'co-founder'
CREATE OR REPLACE FUNCTION public.is_founder_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'founder', 'co-founder')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Reset and Reconfigure Row-Level Security (RLS) Policies

-- -------------------------------------------------------------
-- SALARIES TABLE (HIGH SENSITIVITY: ADMIN ONLY)
-- Founders CANNOT SELECT, INSERT, UPDATE, OR DELETE salaries.
-- -------------------------------------------------------------
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Access on salaries" ON public.salaries;
DROP POLICY IF EXISTS "Salaries Admin Full Access" ON public.salaries;
DROP POLICY IF EXISTS "Salaries Founder View" ON public.salaries;

CREATE POLICY "Salaries Admin Full Access" ON public.salaries
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- -------------------------------------------------------------
-- EMPLOYEES TABLE (CONTAINS SALARY INFORMATION: ADMIN ONLY)
-- Founders CANNOT SELECT, INSERT, UPDATE, OR DELETE employees.
-- -------------------------------------------------------------
ALTER TABLE IF EXISTS public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Access on employees" ON public.employees;
DROP POLICY IF EXISTS "Employees Admin Full Access" ON public.employees;

CREATE POLICY "Employees Admin Full Access" ON public.employees
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- -------------------------------------------------------------
-- PROJECTS TABLE
-- Founders: SELECT only.
-- Admin: Full access (INSERT, UPDATE, DELETE).
-- -------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Access on projects" ON public.projects;
DROP POLICY IF EXISTS "Projects Read Access" ON public.projects;
DROP POLICY IF EXISTS "Projects Admin Write Access" ON public.projects;

CREATE POLICY "Projects Read Access" ON public.projects
    FOR SELECT
    USING (public.is_founder_or_admin());

CREATE POLICY "Projects Admin Write Access" ON public.projects
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- -------------------------------------------------------------
-- PAYMENTS TABLE
-- Founders: SELECT only.
-- Admin: Full access (INSERT, UPDATE, DELETE).
-- -------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Access on payments" ON public.payments;
DROP POLICY IF EXISTS "Payments Read Access" ON public.payments;
DROP POLICY IF EXISTS "Payments Admin Write Access" ON public.payments;

CREATE POLICY "Payments Read Access" ON public.payments
    FOR SELECT
    USING (public.is_founder_or_admin());

CREATE POLICY "Payments Admin Write Access" ON public.payments
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- -------------------------------------------------------------
-- EXPENSES TABLE
-- Founders: SELECT only.
-- Admin: Full access (INSERT, UPDATE, DELETE).
-- -------------------------------------------------------------
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Access on expenses" ON public.expenses;
DROP POLICY IF EXISTS "Expenses Read Access" ON public.expenses;
DROP POLICY IF EXISTS "Expenses Admin Write Access" ON public.expenses;

CREATE POLICY "Expenses Read Access" ON public.expenses
    FOR SELECT
    USING (public.is_founder_or_admin());

CREATE POLICY "Expenses Admin Write Access" ON public.expenses
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- -------------------------------------------------------------
-- INVOICES TABLE
-- Founders: SELECT only.
-- Admin: Full access (INSERT, UPDATE, DELETE).
-- -------------------------------------------------------------
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Access on invoices" ON public.invoices;
DROP POLICY IF EXISTS "Invoices Read Access" ON public.invoices;
DROP POLICY IF EXISTS "Invoices Admin Write Access" ON public.invoices;

CREATE POLICY "Invoices Read Access" ON public.invoices
    FOR SELECT
    USING (public.is_founder_or_admin());

CREATE POLICY "Invoices Admin Write Access" ON public.invoices
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- -------------------------------------------------------------
-- CLIENTS TABLE
-- Founders: SELECT only.
-- Admin: Full access (INSERT, UPDATE, DELETE).
-- -------------------------------------------------------------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Access on clients" ON public.clients;
DROP POLICY IF EXISTS "Clients Read Access" ON public.clients;
DROP POLICY IF EXISTS "Clients Admin Write Access" ON public.clients;

CREATE POLICY "Clients Read Access" ON public.clients
    FOR SELECT
    USING (public.is_founder_or_admin());

CREATE POLICY "Clients Admin Write Access" ON public.clients
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- -------------------------------------------------------------
-- SETTINGS TABLE
-- Founders: SELECT only.
-- Admin: Full access.
-- -------------------------------------------------------------
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Access on settings" ON public.settings;
DROP POLICY IF EXISTS "Settings Read Access" ON public.settings;
DROP POLICY IF EXISTS "Settings Admin Write Access" ON public.settings;

CREATE POLICY "Settings Read Access" ON public.settings
    FOR SELECT
    USING (public.is_founder_or_admin());

CREATE POLICY "Settings Admin Write Access" ON public.settings
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- -------------------------------------------------------------
-- PROFILES TABLE
-- Non-recursive policy: authenticated users can read profiles
-- Users can update only their own profile
-- -------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin All Access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Self View" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Admin Write" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Allow authenticated to read profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- ==============================================================================
-- 4. CREATE / UPDATE FOUNDER ACCOUNT
-- Default Credentials:
-- Email:    founder@ekodrix.com
-- Password: Founder@Ekodrix2026!  (You can change this password anytime)
-- ==============================================================================
DO $$
DECLARE
    founder_id UUID;
BEGIN
    SELECT id INTO founder_id FROM auth.users WHERE email = 'founder@ekodrix.com';

    IF founder_id IS NULL THEN
        founder_id := uuid_generate_v4();

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
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            founder_id,
            'authenticated',
            'authenticated',
            'founder@ekodrix.com',
            crypt('Founder@Ekodrix2026!', gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"]}',
            '{"full_name": "Ekodrix Founder"}',
            now(),
            now()
        );
    ELSE
        UPDATE auth.users
        SET encrypted_password = crypt('Founder@Ekodrix2026!', gen_salt('bf')),
            updated_at = now()
        WHERE id = founder_id;
    END IF;

    -- Ensure profile exists with role 'founder'
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (founder_id, 'founder@ekodrix.com', 'Ekodrix Founder', 'founder')
    ON CONFLICT (id) DO UPDATE
    SET role = 'founder',
        email = 'founder@ekodrix.com',
        full_name = 'Ekodrix Founder';

    -- Make sure admin account has 'admin' role
    UPDATE public.profiles
    SET role = 'admin'
    WHERE email = 'admin@ekodrix.com';

END $$;
