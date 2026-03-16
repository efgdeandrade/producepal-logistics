import { useState, useEffect } from 'react';
import { Bot, ChevronUp, ChevronDown, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export function AiOversightPanel() {
  const [expanded, setExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [agentMessages, setAgentMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const unresolvedCount = suggestions.length + alerts.length;

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);

    const fetchData = async () => {
      const [sugRes, alertRes, msgRes] = await Promise.all([
        supabase.from('ai_suggestions').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
        supabase.from('ai_alerts').select('*').eq('resolved', false).order('created_at', { ascending: false }),
        supabase.from('ai_agent_messages').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      setSuggestions(sugRes.data || []);
      setAlerts(alertRes.data || []);
      setAgentMessages(msgRes.data || []);
      setLoading(false);
    };
    fetchData();

    const sugChannel = supabase.channel('ai-suggestions-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_suggestions' }, () => {
        supabase.from('ai_suggestions').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(10)
          .then(({ data }) => setSuggestions(data || []));
      }).subscribe();

    const alertChannel = supabase.channel('ai-alerts-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_alerts' }, () => {
        supabase.from('ai_alerts').select('*').eq('resolved', false).order('created_at', { ascending: false })
          .then(({ data }) => setAlerts(data || []));
      }).subscribe();

    return () => {
      supabase.removeChannel(sugChannel);
      supabase.removeChannel(alertChannel);
    };
  }, [expanded]);

  const handleSuggestionAction = async (id: string, status: 'approved' | 'dismissed') => {
    await supabase.from('ai_suggestions').update({
      status,
      actioned_by: user?.id,
      actioned_at: new Date().toISOString(),
    }).eq('id', id);
    toast({ title: `Suggestion ${status}` });
  };

  const handleResolveAlert = async (id: string) => {
    await supabase.from('ai_alerts').update({
      resolved: true,
      resolved_by: user?.id,
      resolved_at: new Date().toISOString(),
    }).eq('id', id);
    toast({ title: 'Alert resolved' });
  };

  const severityColor = (s: string) => {
    if (s === 'critical') return 'bg-intake-danger text-white';
    if (s === 'warning') return 'bg-intake-warning text-white';
    return 'bg-intake-info text-white';
  };

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-intake-brand-light transition-colors text-sm"
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-intake-brand" />
          <span className="font-medium text-intake-text">AI Oversight</span>
        </div>
        <div className="flex items-center gap-1.5">
          {unresolvedCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
              {unresolvedCount}
            </Badge>
          )}
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-intake-surface max-h-[400px]">
          <Tabs defaultValue="suggestions" className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-8 text-xs rounded-none">
              <TabsTrigger value="suggestions" className="text-xs">Suggestions</TabsTrigger>
              <TabsTrigger value="alerts" className="text-xs">Alerts</TabsTrigger>
              <TabsTrigger value="messages" className="text-xs">Messages</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[340px]">
              <TabsContent value="suggestions" className="p-2 space-y-2 mt-0">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                ) : suggestions.length === 0 ? (
                  <p className="text-xs text-intake-text-muted text-center py-4">No pending suggestions</p>
                ) : (
                  suggestions.map((s) => (
                    <div key={s.id} className="border rounded-md p-2 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{s.department}</Badge>
                        <Badge className={`text-[10px] ${severityColor(s.priority || 'info')}`}>{s.priority}</Badge>
                      </div>
                      <p className="text-xs font-medium text-intake-text">{s.title}</p>
                      <div className="flex gap-1">
                        <Button size="sm" variant="default" className="h-6 text-[10px] bg-intake-brand hover:bg-intake-accent"
                          onClick={() => handleSuggestionAction(s.id, 'approved')}>
                          <Check className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px]"
                          onClick={() => handleSuggestionAction(s.id, 'dismissed')}>
                          <X className="h-3 w-3 mr-1" /> Dismiss
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="alerts" className="p-2 space-y-2 mt-0">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                ) : alerts.length === 0 ? (
                  <p className="text-xs text-intake-text-muted text-center py-4">No unresolved alerts</p>
                ) : (
                  alerts.map((a) => (
                    <div key={a.id} className="border rounded-md p-2 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Badge className={`text-[10px] ${severityColor(a.severity || 'info')}`}>{a.severity}</Badge>
                        <Badge variant="outline" className="text-[10px]">{a.department}</Badge>
                      </div>
                      <p className="text-xs font-medium text-intake-text">{a.title}</p>
                      <p className="text-[10px] text-intake-text-muted">{a.message}</p>
                      <Button size="sm" variant="outline" className="h-6 text-[10px]"
                        onClick={() => handleResolveAlert(a.id)}>
                        Resolve
                      </Button>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="messages" className="p-2 space-y-2 mt-0">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                ) : agentMessages.length === 0 ? (
                  <p className="text-xs text-intake-text-muted text-center py-4">No agent messages</p>
                ) : (
                  agentMessages.map((m) => (
                    <div key={m.id} className="border rounded-md p-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant="outline" className="text-[10px]">{m.from_department}</Badge>
                        <span className="text-[10px] text-intake-text-muted">→</span>
                        <Badge variant="outline" className="text-[10px]">{m.to_department}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{m.message_type}</Badge>
                      </div>
                      <p className="text-[10px] text-intake-text line-clamp-2">{m.content}</p>
                    </div>
                  ))
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      )}
    </div>
  );
}
