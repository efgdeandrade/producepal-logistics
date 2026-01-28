import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { Bot, Activity, Brain, TrendingUp, ChevronRight, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useDreAnalytics } from '@/hooks/useDreAnalytics';
import { Skeleton } from '@/components/ui/skeleton';

export function DreSummaryWidget() {
  const { health, accuracy, sales, isLoading } = useDreAnalytics(7);

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 space-y-3">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getHealthIcon = () => {
    switch (health?.status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getHealthBadge = () => {
    switch (health?.status) {
      case 'healthy': return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Online</Badge>;
      case 'degraded': return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Degraded</Badge>;
      case 'failed': return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Offline</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const accuracyRate = accuracy ? (100 - accuracy.correctionRate).toFixed(0) : '0';

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-gradient-to-r from-primary/10 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Dre AI</span>
            {getHealthBadge()}
          </div>
          <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
            <Link to="/distribution/dre-analytics">
              Analytics <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3">
            {/* Health */}
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1 mb-1">
                {getHealthIcon()}
                <span className="text-xs text-muted-foreground">Uptime</span>
              </div>
              <div className="text-lg font-bold">{health?.uptime.toFixed(0) || 0}%</div>
            </div>

            {/* Accuracy */}
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Brain className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Accuracy</span>
              </div>
              <div className="text-lg font-bold">{accuracyRate}%</div>
            </div>

            {/* Conversions */}
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Convert</span>
              </div>
              <div className="text-lg font-bold">{sales?.conversionRate.toFixed(0) || 0}%</div>
            </div>
          </div>

          {/* Learning Progress */}
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Learning Progress</span>
              <span className="font-medium">{accuracy?.learningProgress.toFixed(0) || 0}%</span>
            </div>
            <Progress value={accuracy?.learningProgress || 0} className="h-1.5" />
          </div>

          {/* Revenue Generated */}
          {sales && sales.revenueGenerated > 0 && (
            <div className="mt-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs text-green-600">Revenue (7d)</span>
                <span className="font-bold text-green-600">
                  {sales.revenueGenerated.toFixed(2)} XCG
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
