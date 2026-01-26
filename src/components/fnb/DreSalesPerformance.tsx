import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, TrendingUp, DollarSign, CheckCircle, Users, BarChart3 } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

interface OutreachStats {
  total_sent: number;
  responses: number;
  conversions: number;
  total_revenue: number;
  response_rate: number;
  conversion_rate: number;
}

interface OutreachByType {
  outreach_type: string;
  count: number;
  responses: number;
  conversions: number;
  revenue: number;
}

export function DreSalesPerformance() {
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  // Fetch overall stats for last 30 days
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dre-outreach-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dre_outreach_log')
        .select('status, customer_responded, order_revenue, order_generated_id')
        .gte('sent_at', `${thirtyDaysAgo}T00:00:00`);

      if (error) throw error;

      const total_sent = data?.length || 0;
      const responses = data?.filter(d => d.customer_responded).length || 0;
      const conversions = data?.filter(d => d.order_generated_id).length || 0;
      const total_revenue = data?.reduce((sum, d) => sum + (d.order_revenue || 0), 0) || 0;

      return {
        total_sent,
        responses,
        conversions,
        total_revenue,
        response_rate: total_sent > 0 ? (responses / total_sent) * 100 : 0,
        conversion_rate: total_sent > 0 ? (conversions / total_sent) * 100 : 0
      } as OutreachStats;
    }
  });

  // Fetch stats by outreach type
  const { data: byType, isLoading: byTypeLoading } = useQuery({
    queryKey: ['dre-outreach-by-type'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dre_outreach_log')
        .select('outreach_type, status, customer_responded, order_revenue, order_generated_id')
        .gte('sent_at', `${thirtyDaysAgo}T00:00:00`);

      if (error) throw error;

      // Group by outreach type
      const grouped: Record<string, OutreachByType> = {};
      for (const row of data || []) {
        const type = row.outreach_type || 'unknown';
        if (!grouped[type]) {
          grouped[type] = { outreach_type: type, count: 0, responses: 0, conversions: 0, revenue: 0 };
        }
        grouped[type].count++;
        if (row.customer_responded) grouped[type].responses++;
        if (row.order_generated_id) grouped[type].conversions++;
        grouped[type].revenue += row.order_revenue || 0;
      }

      return Object.values(grouped).sort((a, b) => b.count - a.count);
    }
  });

  // Fetch recent successful conversions
  const { data: recentConversions } = useQuery({
    queryKey: ['dre-recent-conversions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dre_outreach_log')
        .select(`
          id, 
          outreach_type, 
          order_revenue, 
          sent_at, 
          response_at,
          distribution_customers(name)
        `)
        .not('order_generated_id', 'is', null)
        .order('response_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    }
  });

  // Fetch this week vs last week comparison
  const { data: weekComparison } = useQuery({
    queryKey: ['dre-week-comparison'],
    queryFn: async () => {
      const twoWeeksAgo = format(subDays(new Date(), 14), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('dre_outreach_log')
        .select('sent_at, order_generated_id, order_revenue')
        .gte('sent_at', `${twoWeeksAgo}T00:00:00`);

      if (error) throw error;

      const thisWeek = (data || []).filter(d => d.sent_at >= `${sevenDaysAgo}T00:00:00`);
      const lastWeek = (data || []).filter(d => d.sent_at < `${sevenDaysAgo}T00:00:00`);

      return {
        thisWeek: {
          sent: thisWeek.length,
          conversions: thisWeek.filter(d => d.order_generated_id).length,
          revenue: thisWeek.reduce((sum, d) => sum + (d.order_revenue || 0), 0)
        },
        lastWeek: {
          sent: lastWeek.length,
          conversions: lastWeek.filter(d => d.order_generated_id).length,
          revenue: lastWeek.reduce((sum, d) => sum + (d.order_revenue || 0), 0)
        }
      };
    }
  });

  const formatCurrency = (amount: number) => `${amount.toFixed(2)} XCG`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      missing_order: 'Missing Order',
      missing_item: 'Missing Item',
      inactive_customer: 'Inactive Customer',
      same_day_reminder: 'Same-Day Reminder',
      next_day_planning: 'Next-Day Planning',
      extended_mahaai: 'Extended Same-Day'
    };
    return labels[type] || type;
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      missing_order: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      missing_item: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      inactive_customer: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      same_day_reminder: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      next_day_planning: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      extended_mahaai: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (statsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Dre Sales Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Dre Sales Performance
          <Badge variant="secondary" className="ml-2">AI Salesperson</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Last 30 days of proactive outreach results
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">Messages Sent</span>
            </div>
            <div className="text-2xl font-bold">{stats?.total_sent || 0}</div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Response Rate</span>
            </div>
            <div className="text-2xl font-bold">{formatPercent(stats?.response_rate || 0)}</div>
            <div className="text-xs text-muted-foreground">{stats?.responses || 0} responses</div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Conversion Rate</span>
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatPercent(stats?.conversion_rate || 0)}
            </div>
            <div className="text-xs text-muted-foreground">{stats?.conversions || 0} orders</div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Revenue Generated</span>
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(stats?.total_revenue || 0)}
            </div>
          </div>
        </div>

        {/* Week-over-week comparison */}
        {weekComparison && (
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              This Week vs Last Week
            </h4>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm text-muted-foreground">Messages Sent</div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{weekComparison.thisWeek.sent}</span>
                  {weekComparison.lastWeek.sent > 0 && (
                    <Badge variant={weekComparison.thisWeek.sent >= weekComparison.lastWeek.sent ? 'default' : 'secondary'}>
                      {weekComparison.thisWeek.sent >= weekComparison.lastWeek.sent ? '↑' : '↓'}
                      {Math.abs(((weekComparison.thisWeek.sent - weekComparison.lastWeek.sent) / weekComparison.lastWeek.sent) * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Conversions</div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{weekComparison.thisWeek.conversions}</span>
                  {weekComparison.lastWeek.conversions > 0 && (
                    <Badge variant={weekComparison.thisWeek.conversions >= weekComparison.lastWeek.conversions ? 'default' : 'secondary'}>
                      {weekComparison.thisWeek.conversions >= weekComparison.lastWeek.conversions ? '↑' : '↓'}
                      {Math.abs(((weekComparison.thisWeek.conversions - weekComparison.lastWeek.conversions) / weekComparison.lastWeek.conversions) * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Revenue</div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatCurrency(weekComparison.thisWeek.revenue)}</span>
                  {weekComparison.lastWeek.revenue > 0 && (
                    <Badge variant={weekComparison.thisWeek.revenue >= weekComparison.lastWeek.revenue ? 'default' : 'secondary'}>
                      {weekComparison.thisWeek.revenue >= weekComparison.lastWeek.revenue ? '↑' : '↓'}
                      {Math.abs(((weekComparison.thisWeek.revenue - weekComparison.lastWeek.revenue) / weekComparison.lastWeek.revenue) * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance by Outreach Type */}
        {byType && byType.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Performance by Outreach Type
            </h4>
            <div className="space-y-2">
              {byType.map(type => (
                <div key={type.outreach_type} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge className={getTypeBadgeColor(type.outreach_type)}>
                      {getTypeLabel(type.outreach_type)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{type.count} sent</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span>{type.responses} responses</span>
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {type.conversions} orders ({formatCurrency(type.revenue)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Successful Conversions */}
        {recentConversions && recentConversions.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Recent Successful Conversions
            </h4>
            <div className="space-y-2">
              {recentConversions.map(conv => (
                <div key={conv.id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {(conv.distribution_customers as any)?.name || 'Customer'}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {getTypeLabel(conv.outreach_type || '')}
                    </Badge>
                  </div>
                  <div className="text-green-600 dark:text-green-400 font-semibold">
                    +{formatCurrency(conv.order_revenue || 0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats?.total_sent === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No proactive outreach has been sent yet.</p>
            <p className="text-sm">Dre will start reaching out to customers based on their ordering patterns.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
