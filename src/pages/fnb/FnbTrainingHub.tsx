import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, BookOpen, Users, BarChart3, Languages, MessageCircle } from "lucide-react";
import { useAITraining } from "@/hooks/useAITraining";
import { TrainingReviewCard } from "@/components/fnb/TrainingReviewCard";
import { DreReplyReviewCard } from "@/components/fnb/DreReplyReviewCard";
import { AIStatsOverview } from "@/components/fnb/AIStatsOverview";
import { GlobalAliasManager } from "@/components/fnb/GlobalAliasManager";
import { ContextWordsManager } from "@/components/fnb/ContextWordsManager";
import { DictionaryImportDialog } from "@/components/fnb/DictionaryImportDialog";
import { DictionaryBulkImport } from "@/components/fnb/DictionaryBulkImport";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { toast } from "sonner";

const supabase = supabaseClient as any;

export default function FnbTrainingHub() {
  const [activeTab, setActiveTab] = useState("review");
  const queryClient = useQueryClient();
  const { 
    reviewQueue, 
    isLoadingQueue, 
    stats, 
    isLoadingStats,
    confirmMatch,
    correctMatch,
    skipReview,
    ignoreLine,
    isConfirming,
    isCorrecting,
    isIgnoring,
  } = useAITraining();

  // Fetch pending context words count
  const { data: pendingWordsCount } = useQuery({
    queryKey: ['pending-context-words-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('distribution_context_words')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', false);
      if (error) throw error;
      return count || 0;
    }
  });

  // Fetch Dre reply review queue
  const { data: dreReplyQueue, isLoading: isLoadingDreReplies } = useQuery({
    queryKey: ['dre-reply-review-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_ai_match_logs')
        .select('id, raw_text, dre_reply, detected_language, created_at')
        .eq('needs_language_review', true)
        .eq('source_channel', 'telegram')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Approve Dre reply
  const approveMutation = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from('distribution_ai_match_logs')
        .update({ needs_language_review: false })
        .eq('id', logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dre-reply-review-queue'] });
      toast.success('Reply approved');
    },
  });

  // Correct Dre reply
  const correctReplyMutation = useMutation({
    mutationFn: async ({ logId, correctedReply }: { logId: string; correctedReply: string }) => {
      const { data: { user } } = await supabaseClient.auth.getUser();
      const { error } = await supabase
        .from('distribution_ai_match_logs')
        .update({
          corrected_reply: correctedReply,
          reply_corrected_by: user?.id || null,
          reply_corrected_at: new Date().toISOString(),
          needs_language_review: false,
        })
        .eq('id', logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dre-reply-review-queue'] });
      toast.success('Correction saved');
    },
  });

  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  const handleSkipReply = (logId: string) => {
    setSkippedIds((prev) => new Set(prev).add(logId));
  };

  const filteredDreQueue = (dreReplyQueue || []).filter((log: any) => !skippedIds.has(log.id));

  const pendingCount = stats?.pendingReview || 0;
  const dreReplyCount = filteredDreQueue.length;

  return (
    <div className="flex-1 space-y-4 px-4 md:px-6 py-4 md:py-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6" />
            AI Training Hub
          </h1>
          <p className="text-muted-foreground">
            Help the AI learn your products, customer patterns, and Papiamentu words
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <DictionaryImportDialog />
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-lg px-3 py-1">
              {pendingCount} items
            </Badge>
          )}
          {(pendingWordsCount ?? 0) > 0 && (
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {pendingWordsCount} words
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          <TabsTrigger value="review" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Review Queue</span>
            <span className="sm:hidden">Review</span>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dre-replies" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Dre Replies</span>
            <span className="sm:hidden">Replies</span>
            {dreReplyCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {dreReplyCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dictionary" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Global Aliases</span>
            <span className="sm:hidden">Aliases</span>
          </TabsTrigger>
          <TabsTrigger value="words" className="gap-2">
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">Context Words</span>
            <span className="sm:hidden">Words</span>
            {(pendingWordsCount ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingWordsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">AI Stats</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
        </TabsList>

        {/* Review Queue Tab */}
        <TabsContent value="review" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Items Needing Review</CardTitle>
              <CardDescription>
                Review low-confidence matches and unmatched items. Your corrections help the AI learn.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingQueue ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : reviewQueue && reviewQueue.length > 0 ? (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {reviewQueue.map((log) => (
                      <TrainingReviewCard
                        key={log.id}
                        log={log}
                        onConfirm={confirmMatch}
                        onCorrect={correctMatch}
                        onSkip={skipReview}
                        onIgnore={ignoreLine}
                        isLoading={isConfirming || isCorrecting || isIgnoring}
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">All caught up!</h3>
                  <p className="text-muted-foreground">
                    No items need review right now. The AI is learning well!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dre Replies Tab */}
        <TabsContent value="dre-replies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Dre Reply Review
                {dreReplyCount > 0 && (
                  <Badge variant="destructive">{dreReplyCount} replies need review</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Review Dre's Telegram replies for language quality. Approve good replies or correct mistakes to improve Papiamentu accuracy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingDreReplies ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : filteredDreQueue.length > 0 ? (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {filteredDreQueue.map((log: any) => (
                      <DreReplyReviewCard
                        key={log.id}
                        log={log}
                        onApprove={(id) => approveMutation.mutate(id)}
                        onCorrect={(id, text) => correctReplyMutation.mutate({ logId: id, correctedReply: text })}
                        onSkip={handleSkipReply}
                        isLoading={approveMutation.isPending || correctReplyMutation.isPending}
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12">
                  <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">All replies reviewed!</h3>
                  <p className="text-muted-foreground">
                    No Dre replies need language review right now.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Global Dictionary Tab */}
        <TabsContent value="dictionary">
          <GlobalAliasManager />
        </TabsContent>

        {/* Context Words Tab */}
        <TabsContent value="words" className="space-y-4">
          <DictionaryBulkImport />
          <ContextWordsManager />
        </TabsContent>

        {/* AI Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          <AIStatsOverview stats={stats} isLoading={isLoadingStats} />
          
          <Card>
            <CardHeader>
              <CardTitle>How Training Works</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">🎯 Confirming Matches</h4>
                  <p className="text-sm text-muted-foreground">
                    When you confirm a match, you're telling the AI it got it right. 
                    This increases confidence for similar matches in the future.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">✏️ Correcting Matches</h4>
                  <p className="text-sm text-muted-foreground">
                    When you correct a match, the AI learns from its mistake. 
                    Adding it as an alias ensures it won't make the same mistake again.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">🌍 Global Aliases</h4>
                  <p className="text-sm text-muted-foreground">
                    Aliases work across all customers. Great for local language terms 
                    like "siboyo" → Onion or "batata" → Potato.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">👤 Customer Mappings</h4>
                  <p className="text-sm text-muted-foreground">
                    Customer-specific mappings are created when you correct orders. 
                    They take priority over global aliases for that customer.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">🗣️ Context Words</h4>
                  <p className="text-sm text-muted-foreground">
                    Papiamentu words like "kaha" (box), "tros" (bunch), or "mañan" (tomorrow)
                    help the AI understand the full context of orders.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">💬 Dre Reply Review</h4>
                  <p className="text-sm text-muted-foreground">
                    Review Dre's Telegram replies to ensure natural Curaçao Papiamentu. 
                    Corrections improve future reply quality.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
