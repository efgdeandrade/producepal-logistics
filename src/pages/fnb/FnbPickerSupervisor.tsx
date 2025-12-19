import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Trophy, AlertTriangle, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { PickerLeaderboard } from '@/components/fnb/PickerLeaderboard';

export default function FnbPickerSupervisor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch leaderboard stats
  const { data: leaderboardStats } = useQuery({
    queryKey: ['fnb-picker-leaderboard'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('fnb_picker_queue')
        .select('picker_name, completed_at, pick_start_time, order_id')
        .eq('status', 'completed')
        .gte('completed_at', today)
        .not('picker_name', 'is', null);

      const { data: activePickers } = await supabase
        .from('fnb_picker_queue')
        .select('picker_name')
        .eq('status', 'in_progress')
        .not('picker_name', 'is', null);

      const activeNames = new Set(activePickers?.map((p: any) => p.picker_name) || []);
      const statsMap: Record<string, { orders: number; totalTime: number; items: number }> = {};
      
      data?.forEach((row: any) => {
        const name = row.picker_name;
        if (!statsMap[name]) statsMap[name] = { orders: 0, totalTime: 0, items: 0 };
        statsMap[name].orders++;
        if (row.pick_start_time && row.completed_at) {
          statsMap[name].totalTime += (new Date(row.completed_at).getTime() - new Date(row.pick_start_time).getTime()) / 60000;
        }
      });

      return Object.entries(statsMap).map(([name, stats]) => ({
        picker_name: name,
        orders_completed: stats.orders,
        avg_pick_time_minutes: stats.orders > 0 ? stats.totalTime / stats.orders : 0,
        items_picked: stats.items,
        is_active: activeNames.has(name),
      }));
    },
    refetchInterval: 5000,
  });

  // Fetch pending shortages
  const { data: pendingShortages } = useQuery({
    queryKey: ['fnb-pending-shortages'],
    queryFn: async () => {
      const { data } = await supabase
        .from('fnb_order_items')
        .select(`*, fnb_products(name, code), fnb_orders(order_number, fnb_customers(name))`)
        .eq('shortage_status', 'pending');
      return data || [];
    },
    refetchInterval: 5000,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ itemId, approved }: { itemId: string; approved: boolean }) => {
      await supabase
        .from('fnb_order_items')
        .update({
          shortage_status: approved ? 'approved' : 'rejected',
          shortage_approved_by: user?.id,
          shortage_approved_at: new Date().toISOString(),
        })
        .eq('id', itemId);
    },
    onSuccess: (_, { approved }) => {
      queryClient.invalidateQueries({ queryKey: ['fnb-pending-shortages'] });
      toast.success(approved ? 'Shortage approved' : 'Shortage rejected');
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fnb"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold">Picker Supervisor Dashboard</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Today's Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PickerLeaderboard stats={leaderboardStats || []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Pending Shortage Approvals
                {pendingShortages && pendingShortages.length > 0 && (
                  <Badge variant="destructive">{pendingShortages.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingShortages && pendingShortages.length > 0 ? (
                <div className="space-y-3">
                  {pendingShortages.map((item: any) => (
                    <div key={item.id} className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{item.fnb_products?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Order: {item.fnb_orders?.order_number} • {item.fnb_orders?.fnb_customers?.name}
                          </p>
                        </div>
                        <Badge variant="outline">{item.short_reason}</Badge>
                      </div>
                      <p className="text-sm mb-3">
                        Ordered: {item.quantity} → Available: {item.picked_quantity} (Short: {item.short_quantity})
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approveMutation.mutate({ itemId: item.id, approved: true })}>
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => approveMutation.mutate({ itemId: item.id, approved: false })}>
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No pending approvals</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
