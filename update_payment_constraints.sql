-- ==============================================================================
-- EKODRIX FINANCE: DATABASE COMPATIBILITY SCRIPT (ZERO DATA LOSS)
-- ==============================================================================
-- This script DOES NOT delete, alter, or touch any of your existing data or rows.
-- It only updates table check constraints and defaults so that:
-- 1. 'Bank Transfer' and 'Other' are natively accepted by PostgreSQL.
-- 2. 'payment_type' defaults to 'Partial' if omitted.
-- 3. Custom expense categories are permitted.
-- ==============================================================================

-- 1. PAYMENTS TABLE: Allow 'Bank Transfer' and 'Other' in payment_method
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check 
  CHECK (payment_method IN ('Bank', 'Bank Transfer', 'UPI', 'Cash', 'Card', 'Other'));

-- 2. PAYMENTS TABLE: Ensure payment_type allows standard values and defaults to 'Partial'
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_type_check 
  CHECK (payment_type IN ('Advance', 'Partial', 'Final', 'Full'));
ALTER TABLE public.payments ALTER COLUMN payment_type SET DEFAULT 'Partial';

-- 3. EXPENSES TABLE: Allow 'Bank Transfer' and 'Other' in payment_method
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_payment_method_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_payment_method_check 
  CHECK (payment_method IN ('Bank', 'Bank Transfer', 'UPI', 'Cash', 'Card', 'Other'));

-- 4. EXPENSES TABLE: Allow 'Project' and any custom category cleanly
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check 
  CHECK (category IS NOT NULL AND length(trim(category)) > 0);
