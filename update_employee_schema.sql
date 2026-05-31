-- ==========================================
-- Add Employees Module
-- ==========================================

-- 1. Employees Table
CREATE TABLE public.employees (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT,
    salary NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for Updated At on employees
CREATE TRIGGER update_employees_modtime BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Row Level Security (RLS) Policies
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All Access on employees" ON public.employees FOR ALL USING (is_admin());

-- 2. Update Salaries Table to link to Employees
ALTER TABLE public.salaries 
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;

-- Note: We retain employee_name and employee_email on salaries for historical records, 
-- in case the employee is deleted or their details change in the future, the salary receipt remains accurate.
