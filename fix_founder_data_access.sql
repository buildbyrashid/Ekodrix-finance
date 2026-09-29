-- ==============================================================================
-- ALLOW ACCURATE EXPENSE & CASHFLOW TOTALS FOR FOUNDERS
-- ==============================================================================
-- Run this in your Supabase SQL Editor.
-- This allows the dashboard to compute the full business expenses (₹530,177)
-- and net cashflow (₹41,157) so the founder dashboard matches the true totals.
-- The salaries and employees pages remain completely hidden/blocked in the UI.
-- ==============================================================================

-- 1. Enable authenticated SELECT on salaries so total expenses and cashflow match
DROP POLICY IF EXISTS "Allow authenticated read on salaries" ON public.salaries;
CREATE POLICY "Allow authenticated read on salaries" ON public.salaries
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. Keep INSERT / UPDATE / DELETE on salaries strictly for admin only
DROP POLICY IF EXISTS "Admin write on salaries" ON public.salaries;
CREATE POLICY "Admin write on salaries" ON public.salaries
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
