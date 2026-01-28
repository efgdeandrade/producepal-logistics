import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Bot, Activity, Brain, TrendingUp, MessageSquare, CheckCircle, AlertTriangle, 
  XCircle, Heart, Meh, Frown, ArrowLeft, Clock, Zap, Target, DollarSign,
  Users, BarChart3, Sparkles, RefreshCw, Shield
} from 'lucide-react';
import { useDreAnalytics } from '@/hooks/useDreAnalytics';
import { useWhatsAppHealthHistory } from '@/hooks/useWhatsAppHealth';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function FnbDreAnalytics() {
  const { health, accuracy, sales, conversations, isLoading } = useDreAnalytics(30);
  const { data: healthHistory } = useWhatsAppHealthHistory(48);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500 bg-green-500/10';
      case 'degraded': return 'text-yellow-500 bg-yellow-500/10';
      case 'failed': return 'text-red-500 bg-red-500/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5" />;
      case 'degraded': return <AlertTriangle className="h-5 w-5" />;
      case 'failed': return <XCircle className="h-5 w-5" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-6">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const accuracyRate = accuracy ? (100 - accuracy.correctionRate) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/distribution">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Dre AI Analytics</h1>
                  <p className="text-sm text-muted-foreground">Performance, health & learning metrics</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(health?.status || 'unknown')}>
              {getStatusIcon(health?.status || 'unknown')}
              <span className="ml-1 capitalize">{health?.status || 'Unknown'}</span>
            </Badge>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-green-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <Activity className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{health?.uptime.toFixed(1)}%</span>
              </div>
              <p className="text-sm font-medium">System Uptime</p>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <Brain className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{accuracyRate.toFixed(1)}%</span>
              </div>
              <p className="text-sm font-medium">Match Accuracy</p>
              <p className="text-xs text-muted-foreground">{accuracy?.totalMatches || 0} total matches</p>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <Target className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold">{sales?.conversionRate.toFixed(1)}%</span>
              </div>
              <p className="text-sm font-medium">Conversion Rate</p>
              <p className="text-xs text-muted-foreground">{sales?.conversions || 0} orders generated</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                <span className="text-2xl font-bold">{(sales?.revenueGenerated || 0).toFixed(0)}</span>
              </div>
              <p className="text-sm font-medium">Revenue (XCG)</p>
              <p className="text-xs text-muted-foreground">From AI outreach</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="health" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="health" className="gap-2">
              <Shield className="h-4 w-4" /> Health
            </TabsTrigger>
            <TabsTrigger value="accuracy" className="gap-2">
              <Brain className="h-4 w-4" /> Accuracy
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2">
              <TrendingUp className="h-4 w-4" /> Sales
            </TabsTrigger>
            <TabsTrigger value="conversations" className="gap-2">
              <MessageSquare className="h-4 w-4" /> Conversations
            </TabsTrigger>
          </TabsList>

          {/* Health Tab */}
          <TabsContent value="health" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5" /> System Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span>WhatsApp API</span>
                    <Badge className={getStatusColor(health?.status || 'unknown')}>
                      {health?.status || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span>Token Status</span>
                    <Badge className={health?.tokenValid ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}>
                      {health?.tokenValid ? 'Valid' : 'Invalid'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span>Avg Response Time</span>
                    <span className="font-mono">{health?.avgResponseTime.toFixed(0)}ms</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span>Errors (30d)</span>
                    <span className="font-mono text-red-500">{health?.errorCount || 0}</span>
                  </div>
                  {health?.lastCheck && (
                    <p className="text-xs text-muted-foreground text-center">
                      Last checked: {format(new Date(health.lastCheck), 'PPp')}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" /> Recent Health Checks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {healthHistory?.slice(0, 12).map((check, i) => (
                      <div key={i} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">
                          {format(new Date(check.created_at), 'HH:mm')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{check.response_time_ms}ms</span>
                          <div className={`w-2 h-2 rounded-full ${
                            check.status === 'healthy' ? 'bg-green-500' :
                            check.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Accuracy Tab */}
          <TabsContent value="accuracy" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5" /> AI Performance
                  </CardTitle>
                  <CardDescription>Product matching accuracy over 30 days</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Overall Accuracy</span>
                      <span className="font-bold text-green-500">{accuracyRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={accuracyRate} className="h-3" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <CheckCircle className="h-5 w-5 text-green-500 mb-1" />
                      <div className="text-2xl font-bold">{accuracy?.highConfidence || 0}</div>
                      <div className="text-xs text-muted-foreground">High Confidence</div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <RefreshCw className="h-5 w-5 text-blue-500 mb-1" />
                      <div className="text-2xl font-bold">{accuracy?.corrected || 0}</div>
                      <div className="text-xs text-muted-foreground">Corrections Made</div>
                    </div>
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mb-1" />
                      <div className="text-2xl font-bold">{accuracy?.unmatched || 0}</div>
                      <div className="text-xs text-muted-foreground">Unmatched</div>
                    </div>
                    <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <Zap className="h-5 w-5 text-orange-500 mb-1" />
                      <div className="text-2xl font-bold">{accuracy?.pendingReview || 0}</div>
                      <div className="text-xs text-muted-foreground">Pending Review</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="h-5 w-5" /> Learning Progress
                  </CardTitle>
                  <CardDescription>How much Dre has improved</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-6">
                    <div className="text-5xl font-bold text-primary mb-2">
                      {accuracy?.learningProgress.toFixed(0) || 0}%
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Reduction in corrections needed
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2 text-sm">
                      <span>Learning Progress</span>
                      <span>{accuracy?.learningProgress.toFixed(0)}%</span>
                    </div>
                    <Progress value={accuracy?.learningProgress || 0} className="h-2" />
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground">
                      Based on {accuracy?.totalMatches || 0} product matches
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" /> Outreach Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <MessageSquare className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-bold">{sales?.totalOutreach || 0}</div>
                      <div className="text-xs text-muted-foreground">Messages Sent</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <Users className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                      <div className="text-2xl font-bold">{sales?.responseRate.toFixed(0) || 0}%</div>
                      <div className="text-xs text-muted-foreground">Response Rate</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-green-500/10">
                      <Target className="h-6 w-6 mx-auto mb-2 text-green-500" />
                      <div className="text-2xl font-bold text-green-500">{sales?.conversionRate.toFixed(0) || 0}%</div>
                      <div className="text-xs text-muted-foreground">Conversion Rate</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-emerald-500/10">
                      <DollarSign className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
                      <div className="text-2xl font-bold text-emerald-500">{sales?.avgOrderValue.toFixed(0) || 0}</div>
                      <div className="text-xs text-muted-foreground">Avg Order (XCG)</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" /> Revenue Impact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    <div className="text-4xl font-bold text-green-500">
                      {(sales?.revenueGenerated || 0).toFixed(2)}
                    </div>
                    <p className="text-sm text-muted-foreground">XCG from AI outreach</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Orders Generated</span>
                      <span className="font-medium">{sales?.conversions || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>WhatsApp Orders</span>
                      <span className="font-medium">{sales?.proactiveOrders || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Proactive Revenue</span>
                      <span className="font-medium">{(sales?.proactiveRevenue || 0).toFixed(0)} XCG</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Conversations Tab */}
          <TabsContent value="conversations" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" /> Conversation Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <div className="text-3xl font-bold">{conversations?.totalConversations || 0}</div>
                      <div className="text-xs text-muted-foreground">Total (30d)</div>
                    </div>
                    <div className="p-4 rounded-lg bg-primary/10 text-center">
                      <div className="text-3xl font-bold text-primary">{conversations?.activeToday || 0}</div>
                      <div className="text-xs text-muted-foreground">Active Today</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-sm">Avg Messages/Conversation</span>
                      <span className="font-mono">{conversations?.avgConversationLength.toFixed(1) || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-sm">AI Resolution Rate</span>
                      <span className="font-mono text-green-500">{conversations?.aiResolutionRate.toFixed(0) || 0}%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-sm">Human Takeovers</span>
                      <span className="font-mono">{conversations?.humanTakeovers || 0} ({conversations?.humanTakeoverRate.toFixed(0) || 0}%)</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-sm">Escalations</span>
                      <span className="font-mono">{conversations?.escalations || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Heart className="h-5 w-5 text-pink-500" /> Customer Sentiment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-500/10">
                        <Heart className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Positive</span>
                          <span className="text-sm font-medium">{conversations?.sentimentPositive || 0}</span>
                        </div>
                        <Progress 
                          value={conversations?.totalConversations ? (conversations.sentimentPositive / conversations.totalConversations) * 100 : 0} 
                          className="h-2 bg-green-500/20"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-gray-500/10">
                        <Meh className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Neutral</span>
                          <span className="text-sm font-medium">{conversations?.sentimentNeutral || 0}</span>
                        </div>
                        <Progress 
                          value={conversations?.totalConversations ? (conversations.sentimentNeutral / conversations.totalConversations) * 100 : 0} 
                          className="h-2 bg-gray-500/20"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-red-500/10">
                        <Frown className="h-5 w-5 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Negative</span>
                          <span className="text-sm font-medium">{conversations?.sentimentNegative || 0}</span>
                        </div>
                        <Progress 
                          value={conversations?.totalConversations ? (conversations.sentimentNegative / conversations.totalConversations) * 100 : 0} 
                          className="h-2 bg-red-500/20"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
