import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  ExternalLink, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useMarketNews, getCountryFlag, getCountryName, type MarketNewsItem } from "@/hooks/useMarketNews";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

function ImpactBadge({ level, type }: { level: string | null; type: string | null }) {
  if (!level) return null;
  
  const levelConfig = {
    high: { 
      className: 'bg-red-500/10 text-red-600 border-red-500/20',
      icon: AlertTriangle 
    },
    medium: { 
      className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      icon: null 
    },
    low: { 
      className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      icon: null 
    },
  };
  
  const typeIcon = type === 'opportunity' ? TrendingUp : type === 'risk' ? TrendingDown : null;
  const config = levelConfig[level as keyof typeof levelConfig] || levelConfig.low;
  const Icon = typeIcon || config.icon;
  
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", config.className)}>
      {Icon && <Icon className="h-3 w-3 mr-1" />}
      {level.toUpperCase()}
    </Badge>
  );
}

function NewsCard({ news, expanded, onToggle }: { 
  news: MarketNewsItem; 
  expanded: boolean;
  onToggle: () => void;
}) {
  const financialImpact = news.financial_impact_estimate;
  const hasFinancialImpact = financialImpact !== null && financialImpact !== 0;
  
  return (
    <div 
      className={cn(
        "border rounded-lg p-4 transition-all hover:shadow-md cursor-pointer",
        news.impact_level === 'high' && "border-red-200 bg-red-50/50 dark:bg-red-950/20",
        news.impact_level === 'medium' && "border-yellow-200 bg-yellow-50/30 dark:bg-yellow-950/10",
        news.impact_level === 'low' && "border-border"
      )}
      onClick={onToggle}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getCountryFlag(news.country_code)}</span>
          <ImpactBadge level={news.impact_level} type={news.impact_type} />
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </div>
      
      {/* Headline */}
      <h4 className="font-semibold text-sm mb-1 line-clamp-2">
        {news.headline}
      </h4>
      
      {/* Affected products */}
      {news.affected_products && news.affected_products.length > 0 && (
        <p className="text-xs text-muted-foreground mb-2">
          Affects: {news.affected_products.slice(0, 3).join(', ')}
          {news.affected_products.length > 3 && ` +${news.affected_products.length - 3} more`}
        </p>
      )}
      
      {/* Financial impact */}
      {hasFinancialImpact && (
        <div className={cn(
          "flex items-center gap-1 text-sm font-medium mb-2",
          news.financial_impact_direction === 'gain' && "text-green-600",
          news.financial_impact_direction === 'loss' && "text-red-600"
        )}>
          {news.financial_impact_direction === 'gain' ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
          <span>
            {news.financial_impact_direction === 'gain' ? 'Opportunity' : 'Potential impact'}: 
            ${Math.abs(financialImpact).toLocaleString()}
          </span>
        </div>
      )}
      
      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {/* Summary */}
          {news.summary && (
            <p className="text-sm text-muted-foreground">
              {news.summary}
            </p>
          )}
          
          {/* AI Recommendation */}
          {news.ai_recommendation && (
            <div className="bg-primary/5 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI Recommendation</span>
              </div>
              <p className="text-sm">
                {news.ai_recommendation}
              </p>
              
              {/* Action items */}
              {news.ai_action_items && news.ai_action_items.length > 0 && (
                <div className="mt-2 space-y-1">
                  {news.ai_action_items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px]",
                          item.priority === 'immediate' && "bg-red-100 text-red-700",
                          item.priority === 'this_week' && "bg-yellow-100 text-yellow-700",
                          item.priority === 'monitor' && "bg-blue-100 text-blue-700"
                        )}
                      >
                        {item.priority}
                      </Badge>
                      <span>{item.action}</span>
                      {item.contact && (
                        <span className="text-muted-foreground">→ {item.contact}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              {news.published_at ? (
                <span>{formatDistanceToNow(new Date(news.published_at), { addSuffix: true })}</span>
              ) : (
                <span>Recent</span>
              )}
              {news.source_name && <span>• {news.source_name}</span>}
            </div>
            {news.source_url && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(news.source_url!, '_blank');
                }}
              >
                Read More
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NewsWidgetSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function MarketNewsWidget() {
  const { news, isLoading, isError, refresh, stats } = useMarketNews();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return <NewsWidgetSkeleton />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            📰 Market Intelligence
          </CardTitle>
          {news.length > 0 && news[0].fetched_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Updated {formatDistanceToNow(new Date(news[0].fetched_at), { addSuffix: true })}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p className="text-sm">Unable to load market news</p>
            <Button variant="link" size="sm" onClick={handleRefresh}>
              Try again
            </Button>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No market news available</p>
            <Button variant="link" size="sm" onClick={handleRefresh}>
              Refresh
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary stats */}
            {stats.highImpact > 0 || stats.opportunities > 0 || stats.risks > 0 ? (
              <div className="flex gap-2 mb-4">
                {stats.highImpact > 0 && (
                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {stats.highImpact} Alert{stats.highImpact > 1 ? 's' : ''}
                  </Badge>
                )}
                {stats.opportunities > 0 && (
                  <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {stats.opportunities} Opportunity
                  </Badge>
                )}
                {stats.risks > 0 && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    {stats.risks} Risk{stats.risks > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            ) : null}
            
            {/* News cards */}
            {news.map((item) => (
              <NewsCard
                key={item.id}
                news={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
