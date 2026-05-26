-- Run this script in your Supabase SQL Editor to update your live database

-- 1. Add the new project_id column to the expenses table
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- 2. Update the category constraint to allow 'Project' as a category
-- (PostgreSQL automatically names the constraint 'expenses_category_check' if it was created inline)
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check 
  CHECK (category IN ('Rent', 'WiFi', 'Electricity', 'Water', 'Salary', 'Subscription', 'Travel', 'Office', 'Miscellaneous', 'Project'));
