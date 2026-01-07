-- Add missing columns to report_executions if needed
ALTER TABLE IF EXISTS report_executions
ADD COLUMN IF NOT EXISTS file_format TEXT,
ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS result_data JSONB;

-- Create report_templates if it doesn't exist
CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  query_config JSONB NOT NULL DEFAULT '{}',
  parameters JSONB DEFAULT '{}',
  visualization_config JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create scheduled_reports if it doesn't exist
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schedule_cron TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  delivery_method TEXT DEFAULT 'email',
  recipients TEXT[] DEFAULT '{}',
  parameters JSONB DEFAULT '{}',
  last_sent_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'America/Curacao',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for report_templates
DROP POLICY IF EXISTS "Users can view public templates or their own" ON public.report_templates;
CREATE POLICY "Users can view public templates or their own" 
ON public.report_templates FOR SELECT 
USING (is_public = true OR auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can create their own templates" ON public.report_templates;
CREATE POLICY "Users can create their own templates" 
ON public.report_templates FOR INSERT 
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own templates" ON public.report_templates;
CREATE POLICY "Users can update their own templates" 
ON public.report_templates FOR UPDATE 
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.report_templates;
CREATE POLICY "Users can delete their own templates" 
ON public.report_templates FOR DELETE 
USING (auth.uid() = created_by);

-- RLS Policies for scheduled_reports
DROP POLICY IF EXISTS "Users can view their own scheduled reports" ON public.scheduled_reports;
CREATE POLICY "Users can view their own scheduled reports" 
ON public.scheduled_reports FOR SELECT 
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can create their own scheduled reports" ON public.scheduled_reports;
CREATE POLICY "Users can create their own scheduled reports" 
ON public.scheduled_reports FOR INSERT 
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own scheduled reports" ON public.scheduled_reports;
CREATE POLICY "Users can update their own scheduled reports" 
ON public.scheduled_reports FOR UPDATE 
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own scheduled reports" ON public.scheduled_reports;
CREATE POLICY "Users can delete their own scheduled reports" 
ON public.scheduled_reports FOR DELETE 
USING (auth.uid() = created_by);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;

-- Add updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_report_templates_updated_at ON report_templates;
CREATE TRIGGER update_report_templates_updated_at
BEFORE UPDATE ON report_templates
FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();

DROP TRIGGER IF EXISTS update_scheduled_reports_updated_at ON scheduled_reports;
CREATE TRIGGER update_scheduled_reports_updated_at
BEFORE UPDATE ON scheduled_reports
FOR EACH ROW EXECUTE FUNCTION update_report_updated_at();