-- ==========================================
-- Ekodrix Finance Migration: Invoices & Payment Enhancements
-- ==========================================

-- 1. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    client_name TEXT,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,
    notes TEXT,
    status TEXT CHECK (status IN ('DRAFT', 'SENT', 'UNPAID', 'PARTIALLY PAID', 'PAID', 'OVERDUE', 'CANCELLED')) DEFAULT 'UNPAID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for updating updated_at timestamp on invoices
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_invoices_modtime'
    ) THEN
        CREATE TRIGGER update_invoices_modtime 
        BEFORE UPDATE ON public.invoices 
        FOR EACH ROW EXECUTE FUNCTION update_modified_column();
    END IF;
END $$;

-- Enable Row Level Security (RLS) on Invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admin All Access on invoices'
    ) THEN
        CREATE POLICY "Admin All Access on invoices" ON public.invoices FOR ALL USING (is_admin());
    END IF;
END $$;

-- 2. Extend Payments Table with optional invoice_id & transaction_reference
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS transaction_reference TEXT;

-- 3. Extend Projects Table with optional project_type & client_name, drop NOT NULL on client_id
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS project_type TEXT,
ADD COLUMN IF NOT EXISTS client_name TEXT;

ALTER TABLE public.projects 
ALTER COLUMN client_id DROP NOT NULL;

