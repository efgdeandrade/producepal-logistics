-- Create team chat system for internal communication

-- Team channels table
CREATE TABLE public.dre_team_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL DEFAULT 'department' CHECK (channel_type IN ('department', 'general', 'direct')),
  department TEXT CHECK (department IN ('logistics', 'management', 'accounting', 'all')),
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Team chat messages
CREATE TABLE public.dre_team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.dre_team_channels(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  message_text TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'escalation', 'system', 'ai_summary')),
  related_conversation_id UUID,
  related_customer_id UUID REFERENCES public.distribution_customers(id),
  metadata JSONB DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Direct messages (for 1:1 chats)
CREATE TABLE public.dre_direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) NOT NULL,
  message_text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Team presence tracking
CREATE TABLE public.dre_team_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  current_view TEXT,
  active_conversations INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Escalation queue for auto-assignment
CREATE TABLE public.dre_escalation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  customer_id UUID REFERENCES public.distribution_customers(id),
  escalation_type TEXT NOT NULL CHECK (escalation_type IN ('order_modification', 'complaint', 'pricing', 'delivery', 'human_request', 'urgent', 'other')),
  assigned_department TEXT CHECK (assigned_department IN ('logistics', 'management', 'accounting')),
  assigned_to UUID REFERENCES auth.users(id),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'cancelled')),
  context JSONB DEFAULT '{}',
  ai_summary TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Channel members
CREATE TABLE public.dre_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.dre_team_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS
ALTER TABLE public.dre_team_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_team_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_escalation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_channel_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view channels" ON public.dre_team_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage channels" ON public.dre_team_channels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view team messages" ON public.dre_team_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can send team messages" ON public.dre_team_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update own messages" ON public.dre_team_messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id);
CREATE POLICY "Users can view their DMs" ON public.dre_direct_messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can send DMs" ON public.dre_direct_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their received DMs" ON public.dre_direct_messages FOR UPDATE TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY "Authenticated users can view presence" ON public.dre_team_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own presence" ON public.dre_team_presence FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can view escalations" ON public.dre_escalation_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage escalations" ON public.dre_escalation_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view channel members" ON public.dre_channel_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage channel members" ON public.dre_channel_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dre_team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dre_direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dre_team_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dre_escalation_queue;

-- Create default channels
INSERT INTO public.dre_team_channels (name, channel_type, department, description) VALUES
  ('General', 'general', 'all', 'Company-wide announcements and discussions'),
  ('Logistics', 'department', 'logistics', 'Delivery, routing, and driver coordination'),
  ('Management', 'department', 'management', 'Operations oversight and escalations'),
  ('Accounting', 'department', 'accounting', 'Invoicing, payments, and COD reconciliation');

-- Create updated_at triggers
CREATE TRIGGER update_dre_team_channels_updated_at BEFORE UPDATE ON public.dre_team_channels FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_dre_team_messages_updated_at BEFORE UPDATE ON public.dre_team_messages FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_dre_team_presence_updated_at BEFORE UPDATE ON public.dre_team_presence FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_dre_escalation_queue_updated_at BEFORE UPDATE ON public.dre_escalation_queue FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();