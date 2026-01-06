-- Drop existing tables if partially created
DROP TABLE IF EXISTS public.employee_documents CASCADE;
DROP TABLE IF EXISTS public.time_entries CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;

-- Create employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  position TEXT,
  hire_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  hourly_rate DECIMAL(10,2),
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  address TEXT,
  profile_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create time_entries table
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  notes TEXT,
  location_lat DECIMAL(10,7),
  location_lng DECIMAL(10,7),
  clock_in_photo_url TEXT,
  clock_out_photo_url TEXT,
  approved_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create employee_documents table
CREATE TABLE public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('id', 'contract', 'certification', 'visa', 'tax', 'other')),
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  expiry_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  uploaded_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employees
CREATE POLICY "Admins and HR can view all employees"
ON public.employees FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'hr', 'management')
  )
);

CREATE POLICY "Employees can view their own record"
ON public.employees FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins and HR can insert employees"
ON public.employees FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'hr')
  )
);

CREATE POLICY "Admins and HR can update employees"
ON public.employees FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'hr')
  )
);

CREATE POLICY "Admins can delete employees"
ON public.employees FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- RLS Policies for time_entries
CREATE POLICY "Admins and HR can view all time entries"
ON public.time_entries FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'hr', 'management')
  )
);

CREATE POLICY "Employees can view their own time entries"
ON public.time_entries FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = time_entries.employee_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Employees can insert their own time entries"
ON public.time_entries FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = employee_id 
    AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'hr')
  )
);

CREATE POLICY "Employees can update their own time entries"
ON public.time_entries FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = time_entries.employee_id 
    AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'hr')
  )
);

-- RLS Policies for employee_documents
CREATE POLICY "Admins and HR can view all documents"
ON public.employee_documents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'hr', 'management')
  )
);

CREATE POLICY "Employees can view their own documents"
ON public.employee_documents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = employee_documents.employee_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Admins and HR can insert documents"
ON public.employee_documents FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'hr')
  )
  OR EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = employee_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Admins and HR can update documents"
ON public.employee_documents FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'hr')
  )
);

CREATE POLICY "Admins can delete documents"
ON public.employee_documents FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create updated_at trigger for employees
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for employee-documents bucket
CREATE POLICY "Authenticated users can upload employee documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-documents');

CREATE POLICY "Authenticated users can view employee documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'employee-documents');

CREATE POLICY "Admins and HR can delete employee documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'hr')
  )
);

-- Create indexes for performance
CREATE INDEX idx_employees_user_id ON public.employees(user_id);
CREATE INDEX idx_employees_status ON public.employees(status);
CREATE INDEX idx_employees_department ON public.employees(department);
CREATE INDEX idx_time_entries_employee_id ON public.time_entries(employee_id);
CREATE INDEX idx_time_entries_clock_in ON public.time_entries(clock_in);
CREATE INDEX idx_employee_documents_employee_id ON public.employee_documents(employee_id);
CREATE INDEX idx_employee_documents_expiry_date ON public.employee_documents(expiry_date);