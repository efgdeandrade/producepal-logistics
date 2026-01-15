import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, HelpCircle, Check, Clock, Package, Bell, CheckCircle, User, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface FnbAlertsCardProps {
  showAudioAlerts?: boolean;
  compact?: boolean;
}

export function FnbAlertsCard({ showAudioAlerts = false, compact = false }: FnbAlertsCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch active shortage alerts (pending/reported)
  const { data: shortageAlerts } = useQuery({
    queryKey: ['fnb-shortage-alerts'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('distribution_order_items')
        .select(`
          id,
          short_quantity,
          short_reason,
          picked_at,
          shortage_alerted_at,
          shortage_status,
          order_id,
          distribution_products(name, code),
          distribution_orders(id, order_number, distribution_customers(name))
        `)
        .gt('short_quantity', 0)
        .eq('shortage_status', 'reported')
        .gte('picked_at', today)
        .order('picked_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Fetch recently resolved shortages (today)
  const { data: resolvedShortages } = useQuery({
    queryKey: ['fnb-resolved-shortages'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('distribution_order_items')
        .select(`
          id,
          short_quantity,
          short_reason,
          shortage_resolved_at,
          shortage_resolved_by,
          picked_quantity,
          quantity,
          order_id,
          distribution_products(name, code),
          distribution_orders(id, order_number, distribution_customers(name))
        `)
        .eq('shortage_status', 'resolved')
        .gte('shortage_resolved_at', today)
        .order('shortage_resolved_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      
      // Get picker names for resolved shortages
      const resolverIds = data?.map(d => d.shortage_resolved_by).filter(Boolean) || [];
      let pickerNames: Record<string, string> = {};
      
      if (resolverIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', resolverIds);
        
        profiles?.forEach(p => {
          pickerNames[p.id] = p.full_name || p.email?.split('@')[0] || 'Unknown';
        });
        
        // Also check picker_queue for picker_name
        const { data: queues } = await supabase
          .from('distribution_picker_queue')
          .select('claimed_by, picker_name')
          .in('claimed_by', resolverIds);
        
        queues?.forEach(q => {
          if (q.picker_name && q.claimed_by) {
            pickerNames[q.claimed_by] = q.picker_name;
          }
        });
      }
      
      return (data || []).map(item => ({
        ...item,
        resolverName: item.shortage_resolved_by ? pickerNames[item.shortage_resolved_by] || 'Picker' : 'Picker',
      }));
    },
    refetchInterval: 15000,
  });

  // Fetch assistance requests
  const { data: assistanceRequests } = useQuery({
    queryKey: ['fnb-assistance-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_assistance_queue')
        .select(`
          *,
          distribution_picker_queue(
            order_id,
            distribution_orders(id, order_number, distribution_customers(name))
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('distribution-alerts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'distribution_assistance_queue' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fnb-assistance-requests'] });
          if (showAudioAlerts) {
            // Play audio alert for new assistance request
            try {
              const audio = new Audio('/notification.mp3');
              audio.volume = 0.5;
              audio.play().catch(() => {});
            } catch {}
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'distribution_order_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fnb-shortage-alerts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, showAudioAlerts]);

  // Acknowledge assistance request
  const acknowledgeMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('distribution_assistance_queue')
        .update({
          status: 'acknowledged',
          acknowledged_by: user?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-assistance-requests'] });
      toast.success('Request acknowledged');
    },
  });

  // Resolve assistance request
  const resolveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('distribution_assistance_queue')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-assistance-requests'] });
      toast.success('Request resolved');
    },
  });

  const activeShortages = shortageAlerts?.length || 0;
  const resolvedCount = resolvedShortages?.length || 0;
  const totalAlerts = activeShortages + (assistanceRequests?.length || 0);

  if (compact && totalAlerts === 0) return null;

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'out_of_stock': return 'Out of Stock';
      case 'damaged': return 'Damaged';
      case 'quality_issue': return 'Quality Issue';
      default: return reason;
    }
  };

  const handleAlertClick = (orderId: string | null | undefined) => {
    if (orderId) {
      navigate(`/fnb/orders/edit/${orderId}`);
    }
  };

  return (
    <Card className={cn(
      totalAlerts > 0 && 'border-orange-400/50 bg-orange-50/50 dark:bg-orange-950/20'
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className={cn(
              "h-5 w-5",
              totalAlerts > 0 ? "text-orange-500 animate-pulse" : "text-muted-foreground"
            )} />
            Alerts
            {totalAlerts > 0 && (
              <Badge variant="destructive" className="ml-1">
                {totalAlerts}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assistance Requests - Higher Priority */}
        {assistanceRequests && assistanceRequests.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <HelpCircle className="h-4 w-4" />
              Assistance Needed ({assistanceRequests.length})
            </h4>
            <div className="space-y-2">
              {assistanceRequests.slice(0, compact ? 2 : 5).map((request: any) => (
                <div
                  key={request.id}
                  className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors group"
                  onClick={() => handleAlertClick(request.distribution_picker_queue?.order_id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate flex items-center gap-1">
                        {request.picker_name} needs help
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity" />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Order: {request.distribution_picker_queue?.distribution_orders?.order_number}
                      </p>
                      <p className="text-xs mt-1">{request.reason}</p>
                      {request.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          "{request.notes}"
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          acknowledgeMutation.mutate(request.id);
                        }}
                        disabled={acknowledgeMutation.isPending}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {format(new Date(request.created_at), 'h:mm a')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Shortage Alerts */}
        {shortageAlerts && shortageAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Active Shortages ({shortageAlerts.length})
            </h4>
            <div className="space-y-1.5">
              {shortageAlerts.slice(0, compact ? 3 : 5).map((alert: any) => (
                <div
                  key={alert.id}
                  className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors group"
                  onClick={() => handleAlertClick(alert.order_id || alert.distribution_orders?.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate flex items-center gap-1">
                        {alert.distribution_products?.name}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity" />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Order: {alert.distribution_orders?.order_number} • {alert.distribution_orders?.distribution_customers?.name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="text-xs">
                        -{alert.short_quantity}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getReasonLabel(alert.short_reason)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recently Resolved Shortages */}
        {resolvedShortages && resolvedShortages.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              Recently Resolved ({resolvedShortages.length})
            </h4>
            <div className="space-y-1.5">
              {resolvedShortages.slice(0, compact ? 2 : 5).map((item: any) => (
                <div
                  key={item.id}
                  className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors group"
                  onClick={() => handleAlertClick(item.order_id || item.distribution_orders?.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate flex items-center gap-1">
                        {item.distribution_products?.name}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity" />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Order: {item.distribution_orders?.order_number} • {item.distribution_orders?.distribution_customers?.name}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200">
                          <User className="h-3 w-3 mr-1" />
                          Resolved by {item.resolverName}
                        </Badge>
                        {item.shortage_resolved_at && (
                          <span className="text-xs text-muted-foreground">
                            • {format(new Date(item.shortage_resolved_at), 'h:mm a')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="text-xs text-green-600 border-green-400">
                        ✓ Resolved
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalAlerts === 0 && (
          <div className="py-6 text-center text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active alerts</p>
            <p className="text-xs">Shortages and assistance requests will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
