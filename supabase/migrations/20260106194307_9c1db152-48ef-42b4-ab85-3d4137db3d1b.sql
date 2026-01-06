-- Phase 6: Analytics & Reporting Tables

-- Scheduled reports table for automated report generation
CREATE TABLE public.scheduled_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- 'executive_summary', 'sales', 'operations', 'inventory', 'custom'
  schedule_cron TEXT NOT NULL, -- Cron format for scheduling
  timezone TEXT DEFAULT 'America/Curacao',
  recipients TEXT[] DEFAULT ARRAY[]::TEXT[], -- Email addresses
  filters JSONB DEFAULT '{}'::JSONB, -- Date range, departments, etc.
  chart_config JSONB DEFAULT '{}'::JSONB, -- Chart types and settings
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT, -- 'success', 'failed', 'pending'
  last_error TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Report execution history
CREATE TABLE public.report_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.scheduled_reports(id) ON DELETE CASCADE,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL, -- 'success', 'failed', 'cancelled'
  recipients_sent TEXT[] DEFAULT ARRAY[]::TEXT[],
  error_message TEXT,
  execution_time_ms INTEGER,
  file_url TEXT, -- URL to generated PDF/Excel if stored
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Saved report templates for custom reports
CREATE TABLE public.report_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL, -- 'chart', 'table', 'summary', 'combined'
  config JSONB NOT NULL, -- Complete template configuration
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Export audit log
CREATE TABLE public.export_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  export_type TEXT NOT NULL, -- 'csv', 'excel', 'pdf'
  entity_type TEXT NOT NULL, -- 'orders', 'customers', 'products', etc.
  record_count INTEGER,
  filters_applied JSONB DEFAULT '{}'::JSONB,
  file_size_bytes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_reports
CREATE POLICY "Users can view scheduled reports" 
ON public.scheduled_reports FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create scheduled reports" 
ON public.scheduled_reports FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own reports or admins" 
ON public.scheduled_reports FOR UPDATE 
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own reports or admins" 
ON public.scheduled_reports FOR DELETE 
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

-- RLS Policies for report_executions
CREATE POLICY "Users can view report executions" 
ON public.report_executions FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert report executions" 
ON public.report_executions FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for report_templates
CREATE POLICY "Users can view public or own templates" 
ON public.report_templates FOR SELECT 
USING (is_public = true OR auth.uid() = created_by);

CREATE POLICY "Users can create templates" 
ON public.report_templates FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own templates" 
ON public.report_templates FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own templates" 
ON public.report_templates FOR DELETE 
USING (auth.uid() = created_by);

-- RLS Policies for export_logs
CREATE POLICY "Users can view export logs" 
ON public.export_logs FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create export logs" 
ON public.export_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_scheduled_reports_next_run ON public.scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX idx_scheduled_reports_created_by ON public.scheduled_reports(created_by);
CREATE INDEX idx_report_executions_report_id ON public.report_executions(report_id);
CREATE INDEX idx_report_executions_executed_at ON public.report_executions(executed_at);
CREATE INDEX idx_export_logs_user ON public.export_logs(user_id, created_at);

-- Triggers for updated_at
CREATE TRIGGER update_scheduled_reports_updated_at
BEFORE UPDATE ON public.scheduled_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_report_templates_updated_at
BEFORE UPDATE ON public.report_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();