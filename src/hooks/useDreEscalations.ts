import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Escalation {
  id: string;
  conversation_id: string;
  customer_id: string | null;
  escalation_type: 'order_modification' | 'complaint' | 'pricing' | 'delivery' | 'human_request' | 'urgent' | 'other';
  assigned_department: 'logistics' | 'management' | 'accounting' | null;
  assigned_to: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'cancelled';
  context: Record<string, unknown>;
  ai_summary: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  customer?: {
    name: string;
    whatsapp_phone: string;
  };
  assignee?: {
    full_name: string;
    email: string;
  };
}

// Mapping escalation types to departments
const ESCALATION_DEPARTMENT_MAP: Record<string, 'logistics' | 'management' | 'accounting'> = {
  order_modification: 'logistics',
  delivery: 'logistics',
  complaint: 'management',
  human_request: 'management',
  urgent: 'management',
  pricing: 'accounting',
  other: 'management',
};

export function useDreEscalations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEscalations = useCallback(async () => {
    const { data, error } = await supabase
      .from('dre_escalation_queue')
      .select('*')
      .in('status', ['pending', 'assigned', 'in_progress'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching escalations:', error);
      return;
    }

    // Fetch customer info separately
    const customerIds = [...new Set((data || []).map(e => e.customer_id).filter(Boolean))] as string[];
    let customerMap = new Map<string, { id: string; name: string; whatsapp_phone: string }>();
    
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('distribution_customers')
        .select('id, name, whatsapp_phone')
        .in('id', customerIds);
      
      customerMap = new Map((customers || []).map(c => [c.id, c]));
    }

    // Fetch assignee info separately
    const assigneeIds = [...new Set((data || []).map(e => e.assigned_to).filter(Boolean))] as string[];
    let profileMap = new Map<string, { id: string; full_name: string; email: string }>();
    
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', assigneeIds);
      
      profileMap = new Map((profiles || []).map(p => [p.id, p]));
    }

    const typedData: Escalation[] = (data || []).map(e => ({
      ...e,
      escalation_type: e.escalation_type as Escalation['escalation_type'],
      assigned_department: e.assigned_department as Escalation['assigned_department'],
      priority: e.priority as Escalation['priority'],
      status: e.status as Escalation['status'],
      context: e.context as Record<string, unknown>,
      customer: e.customer_id ? customerMap.get(e.customer_id) : undefined,
      assignee: e.assigned_to ? profileMap.get(e.assigned_to) : undefined,
    }));

    setEscalations(typedData);
  }, []);

  const createEscalation = useCallback(async (
    conversationId: string,
    customerId: string | null,
    escalationType: Escalation['escalation_type'],
    context: Record<string, unknown>,
    aiSummary?: string
  ) => {
    const assignedDepartment = ESCALATION_DEPARTMENT_MAP[escalationType];
    const priority = escalationType === 'urgent' || escalationType === 'complaint' ? 'high' : 'normal';

    const { error } = await supabase
      .from('dre_escalation_queue')
      .insert([{
        conversation_id: conversationId,
        customer_id: customerId,
        escalation_type: escalationType,
        assigned_department: assignedDepartment,
        priority,
        context: context as unknown as Record<string, never>,
        ai_summary: aiSummary,
      }]);

    if (error) {
      toast({
        title: 'Error creating escalation',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
    
    toast({
      title: 'Escalation created',
      description: `Routed to ${assignedDepartment} department`,
    });
    
    fetchEscalations();
    return true;
  }, [toast, fetchEscalations]);

  const claimEscalation = useCallback(async (escalationId: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from('dre_escalation_queue')
      .update({
        assigned_to: user.id,
        status: 'in_progress',
      })
      .eq('id', escalationId);

    if (error) {
      toast({
        title: 'Error claiming escalation',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Escalation claimed',
      description: 'You are now handling this escalation',
    });
    
    fetchEscalations();
    return true;
  }, [user, toast, fetchEscalations]);

  const resolveEscalation = useCallback(async (escalationId: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from('dre_escalation_queue')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', escalationId);

    if (error) {
      toast({
        title: 'Error resolving escalation',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Escalation resolved',
    });
    
    fetchEscalations();
    return true;
  }, [user, toast, fetchEscalations]);

  useEffect(() => {
    setIsLoading(true);
    fetchEscalations().finally(() => setIsLoading(false));
  }, [fetchEscalations]);

  // Realtime subscription
  useEffect(() => {
    const subscription = supabase
      .channel('escalations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dre_escalation_queue' },
        () => {
          fetchEscalations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchEscalations]);

  // Count by status
  const pendingCount = escalations.filter(e => e.status === 'pending').length;
  const inProgressCount = escalations.filter(e => e.status === 'in_progress').length;

  return {
    escalations,
    isLoading,
    pendingCount,
    inProgressCount,
    createEscalation,
    claimEscalation,
    resolveEscalation,
    fetchEscalations,
  };
}
