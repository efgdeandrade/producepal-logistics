-- Create whatsapp_conversations table for conversation-level tracking
CREATE TABLE public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.distribution_customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_taken_over BOOLEAN NOT NULL DEFAULT false,
  takeover_reason TEXT,
  taken_over_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'waiting', 'escalated')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  last_message_text TEXT,
  last_message_direction TEXT CHECK (last_message_direction IN ('inbound', 'outbound')),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  detected_mood TEXT,
  detected_language TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create whatsapp_conversation_notes table for internal team notes
CREATE TABLE public.whatsapp_conversation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create dre_response_feedback table for AI learning
CREATE TABLE public.dre_response_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  original_response TEXT NOT NULL,
  corrected_response TEXT,
  rating TEXT NOT NULL CHECK (rating IN ('good', 'needs_improvement', 'wrong')),
  feedback_type TEXT CHECK (feedback_type IN ('tone', 'accuracy', 'product_match', 'language', 'other')),
  feedback_notes TEXT,
  corrected_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add sent_by_user_id to whatsapp_messages to track human vs AI responses
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS sent_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_human_response BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS detected_mood TEXT,
ADD COLUMN IF NOT EXISTS detected_intent TEXT;

-- Create indexes for performance
CREATE INDEX idx_whatsapp_conversations_phone ON public.whatsapp_conversations(phone_number);
CREATE INDEX idx_whatsapp_conversations_status ON public.whatsapp_conversations(status);
CREATE INDEX idx_whatsapp_conversations_priority ON public.whatsapp_conversations(priority);
CREATE INDEX idx_whatsapp_conversations_assigned_to ON public.whatsapp_conversations(assigned_to);
CREATE INDEX idx_whatsapp_conversations_last_activity ON public.whatsapp_conversations(last_activity_at DESC);
CREATE INDEX idx_whatsapp_conversation_notes_conversation ON public.whatsapp_conversation_notes(conversation_id);
CREATE INDEX idx_dre_response_feedback_message ON public.dre_response_feedback(message_id);
CREATE INDEX idx_dre_response_feedback_conversation ON public.dre_response_feedback(conversation_id);

-- Enable RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_response_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_conversations
CREATE POLICY "Team members can view all conversations"
  ON public.whatsapp_conversations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Team members can update conversations"
  ON public.whatsapp_conversations
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Team members can insert conversations"
  ON public.whatsapp_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for whatsapp_conversation_notes
CREATE POLICY "Team members can view all notes"
  ON public.whatsapp_conversation_notes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Team members can create notes"
  ON public.whatsapp_conversation_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.whatsapp_conversation_notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.whatsapp_conversation_notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for dre_response_feedback
CREATE POLICY "Team members can view all feedback"
  ON public.dre_response_feedback
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Team members can create feedback"
  ON public.dre_response_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = corrected_by);

CREATE POLICY "Users can update their own feedback"
  ON public.dre_response_feedback
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = corrected_by);

-- Create trigger to update updated_at on whatsapp_conversations
CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversation_notes;