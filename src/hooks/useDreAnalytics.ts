import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export interface DreHealthMetrics {
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  uptime: number;
  avgResponseTime: number;
  lastCheck: string | null;
  errorCount: number;
  tokenValid: boolean;
}

export interface DreAccuracyMetrics {
  totalMatches: number;
  highConfidence: number;
  highConfidenceRate: number;
  corrected: number;
  correctionRate: number;
  unmatched: number;
  unmatchedRate: number;
  pendingReview: number;
  learningProgress: number;
}

export interface DreSalesMetrics {
  totalOutreach: number;
  responses: number;
  responseRate: number;
  conversions: number;
  conversionRate: number;
  revenueGenerated: number;
  avgOrderValue: number;
  proactiveOrders: number;
  proactiveRevenue: number;
  suggestionsAccepted: number;
  suggestionAcceptRate: number;
}

export interface DreConversationMetrics {
  totalConversations: number;
  activeToday: number;
  avgConversationLength: number;
  humanTakeovers: number;
  humanTakeoverRate: number;
  escalations: number;
  resolvedByAI: number;
  aiResolutionRate: number;
  sentimentPositive: number;
  sentimentNeutral: number;
  sentimentNegative: number;
}

export interface DreAnalytics {
  health: DreHealthMetrics;
  accuracy: DreAccuracyMetrics;
  sales: DreSalesMetrics;
  conversations: DreConversationMetrics;
}

export function useDreAnalytics(days = 30) {
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

  // Health metrics
  const healthQuery = useQuery({
    queryKey: ['dre-health-metrics', days],
    queryFn: async (): Promise<DreHealthMetrics> => {
      const { data: checks, error } = await supabase
        .from('whatsapp_health_checks')
        .select('*')
        .gte('created_at', `${startDate}T00:00:00`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const total = checks?.length || 0;
      const healthy = checks?.filter(c => c.status === 'healthy').length || 0;
      const avgResponse = checks?.reduce((sum, c) => sum + (c.response_time_ms || 0), 0) / (total || 1);
      const errors = checks?.filter(c => c.status === 'failed').length || 0;
      const latest = checks?.[0];

      return {
        status: latest?.status as any || 'unknown',
        uptime: total > 0 ? (healthy / total) * 100 : 0,
        avgResponseTime: avgResponse,
        lastCheck: latest?.created_at || null,
        errorCount: errors,
        tokenValid: latest?.token_valid ?? false,
      };
    },
    refetchInterval: 60000,
  });

  // Accuracy metrics from AI match logs
  const accuracyQuery = useQuery({
    queryKey: ['dre-accuracy-metrics', days],
    queryFn: async (): Promise<DreAccuracyMetrics> => {
      const { data: matches, error } = await supabase
        .from('distribution_ai_match_logs')
        .select('confidence, was_corrected, needs_review, matched_product_id')
        .gte('created_at', `${startDate}T00:00:00`);

      if (error) throw error;

      const total = matches?.length || 0;
      const highConf = matches?.filter(m => m.confidence === 'high').length || 0;
      const corrected = matches?.filter(m => m.was_corrected).length || 0;
      const unmatched = matches?.filter(m => !m.matched_product_id).length || 0;
      const pending = matches?.filter(m => m.needs_review).length || 0;

      // Calculate learning progress (fewer corrections over time = better)
      const recentCorrections = matches?.slice(0, Math.floor(total / 3)).filter(m => m.was_corrected).length || 0;
      const oldCorrections = matches?.slice(-Math.floor(total / 3)).filter(m => m.was_corrected).length || 0;
      const learningProgress = oldCorrections > 0 ? Math.max(0, ((oldCorrections - recentCorrections) / oldCorrections) * 100) : 100;

      return {
        totalMatches: total,
        highConfidence: highConf,
        highConfidenceRate: total > 0 ? (highConf / total) * 100 : 0,
        corrected,
        correctionRate: total > 0 ? (corrected / total) * 100 : 0,
        unmatched,
        unmatchedRate: total > 0 ? (unmatched / total) * 100 : 0,
        pendingReview: pending,
        learningProgress,
      };
    },
  });

  // Sales metrics from outreach logs
  const salesQuery = useQuery({
    queryKey: ['dre-sales-metrics', days],
    queryFn: async (): Promise<DreSalesMetrics> => {
      const { data: outreach, error } = await supabase
        .from('dre_outreach_log')
        .select('customer_responded, order_generated_id, order_revenue, outreach_type')
        .gte('sent_at', `${startDate}T00:00:00`);

      if (error) throw error;

      const total = outreach?.length || 0;
      const responses = outreach?.filter(o => o.customer_responded).length || 0;
      const conversions = outreach?.filter(o => o.order_generated_id).length || 0;
      const revenue = outreach?.reduce((sum, o) => sum + (o.order_revenue || 0), 0) || 0;
      
      // Get orders with WA- prefix (WhatsApp orders)
      const { data: waOrders } = await supabase
        .from('distribution_orders')
        .select('id, total_xcg, order_number')
        .like('order_number', 'WA-%')
        .gte('created_at', `${startDate}T00:00:00`);

      const proactiveOrders = waOrders?.length || 0;
      const proactiveRevenue = waOrders?.reduce((sum, o) => sum + (o.total_xcg || 0), 0) || 0;

      return {
        totalOutreach: total,
        responses,
        responseRate: total > 0 ? (responses / total) * 100 : 0,
        conversions,
        conversionRate: total > 0 ? (conversions / total) * 100 : 0,
        revenueGenerated: revenue,
        avgOrderValue: conversions > 0 ? revenue / conversions : 0,
        proactiveOrders,
        proactiveRevenue,
        suggestionsAccepted: conversions,
        suggestionAcceptRate: responses > 0 ? (conversions / responses) * 100 : 0,
      };
    },
  });

  // Conversation metrics from existing tables
  const conversationQuery = useQuery({
    queryKey: ['dre-conversation-metrics', days],
    queryFn: async (): Promise<DreConversationMetrics> => {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Get conversations from distribution_conversations table
      const { data: convs, error } = await supabase
        .from('distribution_conversations')
        .select('id, direction, parsed_intent, created_at, customer_id')
        .gte('created_at', `${startDate}T00:00:00`);

      if (error) throw error;

      // Group by customer_id to count unique conversations
      const customerConvs = new Map<string, any[]>();
      convs?.forEach(c => {
        const key = c.customer_id || 'unknown';
        if (!customerConvs.has(key)) customerConvs.set(key, []);
        customerConvs.get(key)!.push(c);
      });

      const total = customerConvs.size;
      const activeToday = convs?.filter(c => c.created_at?.startsWith(today)).length || 0;
      const avgLength = total > 0 ? (convs?.length || 0) / total : 0;
      
      // Get escalations from queue
      const { data: escalations } = await supabase
        .from('dre_escalation_queue')
        .select('id, status')
        .gte('created_at', `${startDate}T00:00:00`);

      const totalEscalations = escalations?.length || 0;
      const humanTakeovers = escalations?.filter(e => e.status === 'resolved').length || 0;

      // Estimate sentiment from intent parsing
      const positiveIntents = ['order', 'confirm', 'thank'];
      const negativeIntents = ['complaint', 'cancel', 'problem'];
      
      const positive = convs?.filter(c => positiveIntents.some(i => c.parsed_intent?.includes(i))).length || 0;
      const negative = convs?.filter(c => negativeIntents.some(i => c.parsed_intent?.includes(i))).length || 0;
      const neutral = (convs?.length || 0) - positive - negative;

      return {
        totalConversations: total,
        activeToday,
        avgConversationLength: avgLength,
        humanTakeovers,
        humanTakeoverRate: total > 0 ? (humanTakeovers / total) * 100 : 0,
        escalations: totalEscalations,
        resolvedByAI: total - humanTakeovers,
        aiResolutionRate: total > 0 ? ((total - humanTakeovers) / total) * 100 : 0,
        sentimentPositive: positive,
        sentimentNeutral: neutral,
        sentimentNegative: negative,
      };
    },
  });

  return {
    health: healthQuery.data,
    accuracy: accuracyQuery.data,
    sales: salesQuery.data,
    conversations: conversationQuery.data,
    isLoading: healthQuery.isLoading || accuracyQuery.isLoading || salesQuery.isLoading || conversationQuery.isLoading,
    error: healthQuery.error || accuracyQuery.error || salesQuery.error || conversationQuery.error,
  };
}
