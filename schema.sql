-- ==========================================
-- Ekodrix Finance PWA Database Schema
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role TEXT CHECK (role IN ('founder', 'co-founder', 'admin')) DEFAULT 'founder',
    full_name TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Clients Table
CREATE TABLE public.clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Projects Table
CREATE TABLE public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    total_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
    start_date DATE,
    due_date DATE,
    status TEXT CHECK (status IN ('Pending', 'In Progress', 'Partial Payment', 'Completed', 'Fully Paid')) DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Payments Table (Project Payments)
CREATE TABLE public.payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_type TEXT CHECK (payment_type IN ('Advance', 'Partial', 'Final')) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('Bank', 'UPI', 'Cash', 'Card')) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Expenses Table
CREATE TABLE public.expenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    category TEXT CHECK (category IN ('Rent', 'WiFi', 'Electricity', 'Water', 'Salary', 'Subscription', 'Travel', 'Office', 'Miscellaneous', 'Project')) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('Bank', 'UPI', 'Cash', 'Card')) NOT NULL,
    notes TEXT,
    is_recurring BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Salaries Table
CREATE TABLE public.salaries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_name TEXT NOT NULL,
    role TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    month_year DATE NOT NULL, -- Storing the first of the month
    payment_status TEXT CHECK (payment_status IN ('Pending', 'Paid')) DEFAULT 'Pending',
    payment_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Settings Table
CREATE TABLE public.settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_name TEXT DEFAULT 'Ekodrix',
    currency TEXT DEFAULT 'INR',
    theme_preference TEXT DEFAULT 'system',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- Triggers for Updated At
-- ==========================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_modtime BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_projects_modtime BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_settings_modtime BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ==========================================
-- Trigger to automatically update Project Status based on Payments
-- ==========================================
CREATE OR REPLACE FUNCTION update_project_status()
RETURNS TRIGGER AS $$
DECLARE
    total_paid NUMERIC;
    project_val NUMERIC;
BEGIN
    -- Get total value of project
    SELECT total_value INTO project_val FROM public.projects WHERE id = NEW.project_id;
    
    -- Get total paid amount for this project
    SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM public.payments WHERE project_id = NEW.project_id;
    
    -- Update status
    IF total_paid >= project_val THEN
        UPDATE public.projects SET status = 'Fully Paid' WHERE id = NEW.project_id;
    ELSIF total_paid > 0 THEN
        UPDATE public.projects SET status = 'Partial Payment' WHERE id = NEW.project_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER on_payment_added AFTER INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_project_status();
CREATE TRIGGER on_payment_deleted AFTER DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_project_status();

-- ==========================================
-- Row Level Security (RLS) Policies
-- Only Founders and Admins can access data
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin/founder
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('founder', 'co-founder', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply policies to tables
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('CREATE POLICY "Admin All Access on %I" ON public.%I FOR ALL USING (is_admin())', t_name, t_name);
    END LOOP;
END
$$;

-- Allow user to view their own profile
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- Create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- Admin Seeding (admin@ekodrix.com)
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
  uuid_generate_v4(),
  'authenticated',
  'authenticated',
  'admin@ekodrix.com',
  crypt('Ekodrix@2026!', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Ekodrix Admin"}',
  now(),
  now()
);

-- Update the auto-created profile to have admin role
UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@ekodrix.com';
