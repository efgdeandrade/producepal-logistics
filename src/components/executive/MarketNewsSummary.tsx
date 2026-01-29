import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { useMarketNews, getCountryFlag } from "@/hooks/useMarketNews";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function MarketNewsSummary() {
  const { news, isLoading, isError, refresh, stats } = useMarketNews();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-2" />
        </CardContent>
      </Card>
    );
  }

  const topStory = stats.topStory;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">📰 Market News</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-yellow-500" />
            Unable to load news
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No market news
          </div>
        ) : (
          <>
            {/* Quick stats */}
            <div className="flex gap-2 mb-4">
              {stats.highImpact > 0 && (
                <div className="flex-1 bg-red-50 dark:bg-red-950/30 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-red-600">{stats.highImpact}</div>
                  <div className="text-xs text-red-600/80">Alert{stats.highImpact > 1 ? 's' : ''}</div>
                </div>
              )}
              {stats.opportunities > 0 && (
                <div className="flex-1 bg-green-50 dark:bg-green-950/30 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-600">{stats.opportunities}</div>
                  <div className="text-xs text-green-600/80">Opp{stats.opportunities > 1 ? 's' : ''}</div>
                </div>
              )}
              {stats.risks > 0 && (
                <div className="flex-1 bg-orange-50 dark:bg-orange-950/30 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-orange-600">{stats.risks}</div>
                  <div className="text-xs text-orange-600/80">Risk{stats.risks > 1 ? 's' : ''}</div>
                </div>
              )}
              {stats.highImpact === 0 && stats.opportunities === 0 && stats.risks === 0 && (
                <div className="flex-1 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-600">{stats.totalNews}</div>
                  <div className="text-xs text-blue-600/80">Updates</div>
                </div>
              )}
            </div>
            
            {/* Top story */}
            {topStory && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span>{getCountryFlag(topStory.country_code)}</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      topStory.impact_level === 'high' && "bg-red-50 text-red-600 border-red-200",
                      topStory.impact_level === 'medium' && "bg-yellow-50 text-yellow-600 border-yellow-200"
                    )}
                  >
                    {topStory.impact_type === 'opportunity' && <TrendingUp className="h-3 w-3 mr-1" />}
                    {topStory.impact_type === 'risk' && <TrendingDown className="h-3 w-3 mr-1" />}
                    {topStory.impact_level?.toUpperCase()}
                  </Badge>
                </div>
                
                <p className="text-sm font-medium line-clamp-2">
                  {topStory.headline}
                </p>
                
                {topStory.ai_recommendation && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                    <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{topStory.ai_recommendation}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* View all link */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-3 text-xs"
              onClick={() => navigate('/import')}
            >
              View All News
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
