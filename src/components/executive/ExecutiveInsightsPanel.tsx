import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useExecutiveInsights, ExecutiveInsight } from '@/hooks/useExecutiveInsights';
import { 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle2,
  Sparkles,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const insightIcons = {
  opportunity: TrendingUp,
  warning: AlertTriangle,
  improvement: Lightbulb,
  success: CheckCircle2,
};

const insightColors = {
  opportunity: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  improvement: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  success: 'text-green-500 bg-green-500/10 border-green-500/20',
};

const impactBadges = {
  high: 'bg-red-500/10 text-red-500 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  low: 'bg-muted text-muted-foreground',
};

function InsightCard({ insight }: { insight: ExecutiveInsight }) {
  const Icon = insightIcons[insight.type];
  const colorClass = insightColors[insight.type];
  const impactClass = impactBadges[insight.impact];

  return (
    <div className={`p-4 rounded-lg border ${colorClass} transition-all hover:shadow-md`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-sm">{insight.title}</h4>
            <Badge variant="outline" className={`text-[10px] ${impactClass}`}>
              {insight.impact}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {insight.description}
          </p>
          {insight.metric && (
            <div className="flex items-center gap-1 mt-2">
              <span className="text-xs font-medium">{insight.metric}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ExecutiveInsightsPanel() {
  const { data, isLoading, error, refetch, isFetching } = useExecutiveInsights();

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            Unable to load insights. 
            <Button variant="link" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">AI Business Insights</CardTitle>
              {data?.generatedAt && (
                <CardDescription className="text-[10px]">
                  Updated {formatDistanceToNow(new Date(data.generatedAt), { addSuffix: true })}
                </CardDescription>
              )}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Summary */}
            {data?.summary && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Summary:</strong> {data.summary}
                </p>
              </div>
            )}

            {/* Insights */}
            <div className="space-y-3">
              {data?.insights?.slice(0, 6).map((insight, index) => (
                <InsightCard key={index} insight={insight} />
              ))}
            </div>

            {/* View More */}
            {(data?.insights?.length || 0) > 6 && (
              <Button variant="ghost" size="sm" className="w-full gap-2">
                View all {data?.insights?.length} insights
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
