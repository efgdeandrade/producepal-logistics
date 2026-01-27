-- Create table for internal team chat messages (Dre Command Center)
CREATE TABLE IF NOT EXISTS public.dre_team_chat (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    message_text TEXT NOT NULL,
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dre_team_chat ENABLE ROW LEVEL SECURITY;

-- RLS policies for team chat
CREATE POLICY "Team members can view all chat messages"
ON public.dre_team_chat
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Team members can insert chat messages"
ON public.dre_team_chat
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_dre_team_chat_conversation ON public.dre_team_chat(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dre_team_chat_created ON public.dre_team_chat(created_at DESC);

-- Enable realtime for team chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.dre_team_chat;