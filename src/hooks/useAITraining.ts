import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MatchLog {
  id: string;
  raw_text: string;
  interpreted_text: string | null;
  customer_id: string | null;
  order_id: string | null;
  matched_product_id: string | null;
  match_source: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  was_corrected: boolean;
  corrected_product_id: string | null;
  detected_language: string | null;
  detected_quantity: number | null;
  detected_unit: string | null;
  needs_review: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  customer?: { id: string; name: string } | null;
  matched_product?: { id: string; name: string; code: string } | null;
  corrected_product?: { id: string; name: string; code: string } | null;
  order?: { id: string; order_number: string } | null;
}

export interface LogMatchParams {
  raw_text: string;
  interpreted_text?: string;
  customer_id?: string;
  order_id?: string;
  matched_product_id?: string;
  match_source: string;
  confidence: 'high' | 'medium' | 'low';
  detected_language?: string;
  detected_quantity?: number;
  detected_unit?: string;
  needs_review?: boolean;
}

export function useAITraining() {
  const queryClient = useQueryClient();

  // Fetch items needing review
  const { data: reviewQueue, isLoading: isLoadingQueue } = useQuery({
    queryKey: ['ai-training-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_ai_match_logs')
        .select(`
          *,
          customer:fnb_customers(id, name),
          matched_product:fnb_products!fnb_ai_match_logs_matched_product_id_fkey(id, name, code),
          corrected_product:fnb_products!fnb_ai_match_logs_corrected_product_id_fkey(id, name, code),
          order:fnb_orders(id, order_number)
        `)
        .eq('needs_review', true)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as MatchLog[];
    },
  });

  // Fetch AI stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['ai-training-stats'],
    queryFn: async () => {
      const { data: allLogs, error } = await supabase
        .from('fnb_ai_match_logs')
        .select('confidence, was_corrected, match_source, needs_review')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const total = allLogs?.length || 0;
      const highConfidence = allLogs?.filter(l => l.confidence === 'high').length || 0;
      const corrected = allLogs?.filter(l => l.was_corrected).length || 0;
      const unmatched = allLogs?.filter(l => l.match_source === 'unmatched').length || 0;
      const pendingReview = allLogs?.filter(l => l.needs_review).length || 0;

      return {
        total,
        highConfidence,
        highConfidenceRate: total > 0 ? (highConfidence / total * 100).toFixed(1) : '0',
        corrected,
        correctionRate: total > 0 ? (corrected / total * 100).toFixed(1) : '0',
        unmatched,
        unmatchedRate: total > 0 ? (unmatched / total * 100).toFixed(1) : '0',
        pendingReview,
      };
    },
  });

  // Log a match
  const logMatchMutation = useMutation({
    mutationFn: async (params: LogMatchParams) => {
      const { error } = await supabase
        .from('fnb_ai_match_logs')
        .insert({
          raw_text: params.raw_text,
          interpreted_text: params.interpreted_text,
          customer_id: params.customer_id,
          order_id: params.order_id,
          matched_product_id: params.matched_product_id,
          match_source: params.match_source,
          confidence: params.confidence,
          detected_language: params.detected_language,
          detected_quantity: params.detected_quantity,
          detected_unit: params.detected_unit,
          needs_review: params.needs_review ?? (params.confidence === 'low' || params.match_source === 'unmatched'),
        });

      if (error) throw error;
    },
  });

  // Confirm a match (mark as reviewed, correct)
  const confirmMatchMutation = useMutation({
    mutationFn: async ({ logId, addAsAlias, language }: { logId: string; addAsAlias?: boolean; language?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get the log to potentially create alias
      const { data: log } = await supabase
        .from('fnb_ai_match_logs')
        .select('raw_text, matched_product_id')
        .eq('id', logId)
        .single();

      // Update the log
      const { error } = await supabase
        .from('fnb_ai_match_logs')
        .update({
          needs_review: false,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', logId);

      if (error) throw error;

      // Optionally add as global alias
      if (addAsAlias && log?.matched_product_id && log?.raw_text) {
        const { error: aliasError } = await supabase
          .from('fnb_product_aliases')
          .insert({
            product_id: log.matched_product_id,
            alias: log.raw_text.toLowerCase().trim(),
            language: language || 'pap',
            confidence_score: 1.0,
          });

        if (aliasError && !aliasError.message.includes('duplicate')) {
          console.error('Failed to add alias:', aliasError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-training-queue'] });
      queryClient.invalidateQueries({ queryKey: ['ai-training-stats'] });
      toast.success('Match confirmed');
    },
  });

  // Correct a match
  const correctMatchMutation = useMutation({
    mutationFn: async ({ 
      logId, 
      correctProductId, 
      addAsAlias, 
      language 
    }: { 
      logId: string; 
      correctProductId: string; 
      addAsAlias?: boolean; 
      language?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Get the log for the raw text
      const { data: log } = await supabase
        .from('fnb_ai_match_logs')
        .select('raw_text')
        .eq('id', logId)
        .single();

      // Update the log
      const { error } = await supabase
        .from('fnb_ai_match_logs')
        .update({
          was_corrected: true,
          corrected_product_id: correctProductId,
          needs_review: false,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', logId);

      if (error) throw error;

      // Add as global alias with correct product
      if (addAsAlias && log?.raw_text) {
        const { error: aliasError } = await supabase
          .from('fnb_product_aliases')
          .insert({
            product_id: correctProductId,
            alias: log.raw_text.toLowerCase().trim(),
            language: language || 'pap',
            confidence_score: 1.0,
          });

        if (aliasError && !aliasError.message.includes('duplicate')) {
          console.error('Failed to add alias:', aliasError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-training-queue'] });
      queryClient.invalidateQueries({ queryKey: ['ai-training-stats'] });
      queryClient.invalidateQueries({ queryKey: ['global-aliases'] });
      toast.success('Match corrected - AI will learn from this');
    },
  });

  // Skip review (mark as reviewed without learning)
  const skipReviewMutation = useMutation({
    mutationFn: async (logId: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('fnb_ai_match_logs')
        .update({
          needs_review: false,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', logId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-training-queue'] });
      queryClient.invalidateQueries({ queryKey: ['ai-training-stats'] });
    },
  });

  return {
    reviewQueue,
    isLoadingQueue,
    stats,
    isLoadingStats,
    logMatch: logMatchMutation.mutateAsync,
    confirmMatch: confirmMatchMutation.mutate,
    correctMatch: correctMatchMutation.mutate,
    skipReview: skipReviewMutation.mutate,
    isConfirming: confirmMatchMutation.isPending,
    isCorrecting: correctMatchMutation.isPending,
  };
}
