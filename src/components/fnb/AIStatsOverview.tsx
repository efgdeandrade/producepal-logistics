import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, CheckCircle, AlertTriangle, HelpCircle, TrendingUp, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AIStatsOverviewProps {
  stats: {
    total: number;
    highConfidence: number;
    highConfidenceRate: string;
    corrected: number;
    correctionRate: string;
    unmatched: number;
    unmatchedRate: string;
    pendingReview: number;
  } | undefined;
  isLoading: boolean;
}

export function AIStatsOverview({ stats, isLoading }: AIStatsOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "High Confidence",
      value: `${stats?.highConfidenceRate || 0}%`,
      subtitle: `${stats?.highConfidence || 0} of ${stats?.total || 0} items`,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Corrections Made",
      value: stats?.corrected || 0,
      subtitle: `${stats?.correctionRate || 0}% needed fixing`,
      icon: Brain,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Unmatched",
      value: `${stats?.unmatchedRate || 0}%`,
      subtitle: `${stats?.unmatched || 0} items couldn't match`,
      icon: AlertTriangle,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "Pending Review",
      value: stats?.pendingReview || 0,
      subtitle: "Items need your help",
      icon: HelpCircle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  // Calculate overall AI accuracy (inverse of correction rate)
  const accuracyRate = stats?.total ? (100 - parseFloat(stats.correctionRate || '0')).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* AI Accuracy Summary */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">AI Accuracy</h3>
              <p className="text-sm text-muted-foreground">Based on {stats?.total || 0} matches in the last 30 days</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">{accuracyRate}%</p>
              <p className="text-xs text-muted-foreground">Correct first try</p>
            </div>
          </div>
          <Progress value={parseFloat(accuracyRate)} className="h-2" />
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-medium">Last 30 Days Breakdown</h3>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <div className={`p-2 rounded-full ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
