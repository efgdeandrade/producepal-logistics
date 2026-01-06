import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, MessageSquare, ShoppingCart, FileText, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useActivityLogger } from '@/hooks/useActivityLogger';

interface FnbCustomer {
  id: string;
  name: string;
  whatsapp_phone: string;
  preferred_language: string;
  address: string | null;
  delivery_zone: string | null;
  major_zone_id: string | null;
  customer_type: string;
  notes: string | null;
  pricing_tier_id?: string | null;
}

interface CustomerMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: FnbCustomer[];
  onMergeComplete: () => void;
}

interface CustomerStats {
  orders: number;
  conversations: number;
  mappings: number;
  patterns: number;
  standingItems: number;
}

export function CustomerMergeDialog({
  open,
  onOpenChange,
  customers,
  onMergeComplete,
}: CustomerMergeDialogProps) {
  const [primaryId, setPrimaryId] = useState<string>(customers[0]?.id || '');
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();

  // Sync primaryId when customers change or dialog opens
  useEffect(() => {
    if (open && customers.length > 0 && !primaryId) {
      setPrimaryId(customers[0].id);
    }
  }, [open, customers, primaryId]);

  // Fetch stats for both customers
  const { data: customerStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['customer-merge-stats', customers.map(c => c.id)],
    queryFn: async () => {
      const stats: Record<string, CustomerStats> = {};
      
      for (const customer of customers) {
        const [orders, conversations, mappings, patterns, standingItems] = await Promise.all([
          supabase.from('fnb_orders').select('id', { count: 'exact', head: true }).eq('customer_id', customer.id),
          supabase.from('fnb_conversations').select('id', { count: 'exact', head: true }).eq('customer_id', customer.id),
          supabase.from('fnb_customer_product_mappings').select('id', { count: 'exact', head: true }).eq('customer_id', customer.id),
          supabase.from('fnb_customer_patterns').select('id', { count: 'exact', head: true }).eq('customer_id', customer.id),
          supabase.from('fnb_standing_order_items').select('id', { count: 'exact', head: true }).eq('customer_id', customer.id),
        ]);
        
        stats[customer.id] = {
          orders: orders.count || 0,
          conversations: conversations.count || 0,
          mappings: mappings.count || 0,
          patterns: patterns.count || 0,
          standingItems: standingItems.count || 0,
        };
      }
      
      return stats;
    },
    enabled: open && customers.length === 2,
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!primaryId) {
        throw new Error('Please select a primary customer to keep');
      }
      const secondaryId = customers.find(c => c.id !== primaryId)?.id;
      if (!secondaryId) throw new Error('Could not determine secondary customer');

      const { error } = await supabase.rpc('merge_fnb_customers', {
        primary_id: primaryId,
        secondary_id: secondaryId,
      });

      if (error) throw error;
      
      return { primaryId, secondaryId };
    },
    onSuccess: ({ primaryId, secondaryId }) => {
      const primary = customers.find(c => c.id === primaryId);
      const secondary = customers.find(c => c.id === secondaryId);
      
      logActivity('merge_customers', 'fnb_customer', primaryId, {
        primary_name: primary?.name,
        secondary_name: secondary?.name,
        secondary_id: secondaryId,
      });
      
      queryClient.invalidateQueries({ queryKey: ['fnb-customers'] });
      toast.success(`Successfully merged "${secondary?.name}" into "${primary?.name}"`);
      onMergeComplete();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to merge customers');
    },
  });

  if (customers.length !== 2) {
    return null;
  }

  const primaryCustomer = customers.find(c => c.id === primaryId);
  const secondaryCustomer = customers.find(c => c.id !== primaryId);
  const secondaryStats = secondaryCustomer && customerStats?.[secondaryCustomer.id];

  const totalTransfer = secondaryStats
    ? secondaryStats.orders + secondaryStats.conversations + secondaryStats.mappings + secondaryStats.standingItems
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge Customers</DialogTitle>
          <DialogDescription>
            Select which customer record to keep. All data from the other customer will be transferred.
          </DialogDescription>
        </DialogHeader>

        {isLoadingStats ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading customer data...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Customer Selection */}
            <RadioGroup value={primaryId} onValueChange={setPrimaryId} className="grid grid-cols-2 gap-4">
              {customers.map((customer) => {
                const stats = customerStats?.[customer.id];
                const isSelected = customer.id === primaryId;
                
                return (
                  <div key={customer.id} className="relative">
                    <RadioGroupItem
                      value={customer.id}
                      id={customer.id}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={customer.id}
                      className={`flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-muted-foreground/50'
                      }`}
                    >
                      {isSelected && (
                        <Badge className="absolute -top-2 left-2 text-xs">Keep this one</Badge>
                      )}
                      
                      <span className="font-semibold text-lg mb-1">{customer.name}</span>
                      
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                        <MessageSquare className="h-3 w-3" />
                        {customer.whatsapp_phone}
                      </div>
                      
                      {customer.address && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {customer.address}
                        </p>
                      )}
                      
                      {customer.delivery_zone && (
                        <Badge variant="secondary" className="w-fit text-xs mb-2">
                          {customer.delivery_zone}
                        </Badge>
                      )}
                      
                      {/* Stats */}
                      {stats && (
                        <div className="grid grid-cols-2 gap-1 mt-2 pt-2 border-t text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            {stats.orders} orders
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {stats.conversations} chats
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {stats.mappings} mappings
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {stats.standingItems} standing
                          </div>
                        </div>
                      )}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            {/* Transfer Preview */}
            {secondaryCustomer && secondaryStats && totalTransfer > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">
                  Will be transferred to "{primaryCustomer?.name}":
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {secondaryStats.orders > 0 && (
                    <li>• {secondaryStats.orders} orders</li>
                  )}
                  {secondaryStats.conversations > 0 && (
                    <li>• {secondaryStats.conversations} conversations</li>
                  )}
                  {secondaryStats.mappings > 0 && (
                    <li>• {secondaryStats.mappings} product mappings</li>
                  )}
                  {secondaryStats.standingItems > 0 && (
                    <li>• {secondaryStats.standingItems} standing order items</li>
                  )}
                </ul>
              </div>
            )}

            {/* Warning */}
            <div className="flex items-start gap-3 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong>Warning:</strong> "{secondaryCustomer?.name}" will be permanently deleted after the merge.
                This action cannot be undone.
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => mergeMutation.mutate()}
                disabled={mergeMutation.isPending || !primaryId}
              >
                {mergeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Merge Customers
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
