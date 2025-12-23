import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, HelpCircle, Check, Clock, Package, Bell } from 'lucide-react';
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

  // Fetch shortage alerts (non-blocking - just for visibility)
  const { data: shortageAlerts } = useQuery({
    queryKey: ['fnb-shortage-alerts'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('fnb_order_items')
        .select(`
          id,
          short_quantity,
          short_reason,
          picked_at,
          shortage_alerted_at,
          fnb_products(name, code),
          fnb_orders(order_number, fnb_customers(name))
        `)
        .gt('short_quantity', 0)
        .gte('picked_at', today)
        .order('picked_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Fetch assistance requests
  const { data: assistanceRequests } = useQuery({
    queryKey: ['fnb-assistance-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_assistance_queue')
        .select(`
          *,
          fnb_picker_queue(
            fnb_orders(order_number, fnb_customers(name))
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
      .channel('fnb-alerts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fnb_assistance_queue' },
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
        { event: '*', schema: 'public', table: 'fnb_order_items' },
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
        .from('fnb_assistance_queue')
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
        .from('fnb_assistance_queue')
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

  const totalAlerts = (shortageAlerts?.length || 0) + (assistanceRequests?.length || 0);

  if (compact && totalAlerts === 0) return null;

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'out_of_stock': return 'Out of Stock';
      case 'damaged': return 'Damaged';
      case 'quality_issue': return 'Quality Issue';
      default: return reason;
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
                  className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {request.picker_name} needs help
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Order: {request.fnb_picker_queue?.fnb_orders?.order_number}
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
                        onClick={() => acknowledgeMutation.mutate(request.id)}
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

        {/* Shortage Alerts - Informational */}
        {shortageAlerts && shortageAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Recent Shortages ({shortageAlerts.length})
            </h4>
            <div className="space-y-1.5">
              {shortageAlerts.slice(0, compact ? 3 : 5).map((alert: any) => (
                <div
                  key={alert.id}
                  className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {alert.fnb_products?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Order: {alert.fnb_orders?.order_number} • {alert.fnb_orders?.fnb_customers?.name}
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