import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, BookOpen, Users, BarChart3 } from "lucide-react";
import { useAITraining } from "@/hooks/useAITraining";
import { TrainingReviewCard } from "@/components/fnb/TrainingReviewCard";
import { AIStatsOverview } from "@/components/fnb/AIStatsOverview";
import { GlobalAliasManager } from "@/components/fnb/GlobalAliasManager";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function FnbTrainingHub() {
  const [activeTab, setActiveTab] = useState("review");
  const { 
    reviewQueue, 
    isLoadingQueue, 
    stats, 
    isLoadingStats,
    confirmMatch,
    correctMatch,
    skipReview,
    isConfirming,
    isCorrecting,
  } = useAITraining();

  const pendingCount = stats?.pendingReview || 0;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6" />
            AI Training Hub
          </h1>
          <p className="text-muted-foreground">
            Help the AI learn your products and customer ordering patterns
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-lg px-3 py-1">
            {pendingCount} items need review
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="review" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Review Queue
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="dictionary" className="gap-2">
            <Users className="h-4 w-4" />
            Global Dictionary
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            AI Stats
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
                        isLoading={isConfirming || isCorrecting}
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

        {/* Global Dictionary Tab */}
        <TabsContent value="dictionary">
          <GlobalAliasManager />
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
