-- Add required columns for the Salary Receipt Email feature
ALTER TABLE public.salaries 
  ADD COLUMN IF NOT EXISTS employee_email TEXT,
  ADD COLUMN IF NOT EXISTS receipt_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS receipt_number TEXT;
