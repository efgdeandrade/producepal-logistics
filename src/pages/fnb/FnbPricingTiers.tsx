import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, ArrowLeft, Star, Users, GripVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Cast the backend client to `any` in this page to avoid excessively-deep type instantiation errors
// from complex selects (keeps runtime behavior the same).
const supabase = supabaseClient as any;

interface PricingTier {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  customer_count?: number;
}

const emptyTier = {
  name: '',
  description: '',
  is_default: false,
  is_active: true,
  sort_order: 0,
};

export default function FnbPricingTiers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [formData, setFormData] = useState(emptyTier);
  const queryClient = useQueryClient();

  // Fetch pricing tiers with customer count
  const { data: tiers, isLoading } = useQuery({
    queryKey: ['fnb-pricing-tiers'],
    queryFn: async () => {
      const { data: tiersData, error: tiersError } = await supabase
        .from('distribution_pricing_tiers')
        .select('*')
        .order('sort_order');
      if (tiersError) throw tiersError;

      // Get customer counts per tier
      const { data: customerCounts, error: countError } = await supabase
        .from('distribution_customers')
        .select('pricing_tier_id');
      if (countError) throw countError;

      const countMap: Record<string, number> = {};
      customerCounts?.forEach((c) => {
        if (c.pricing_tier_id) {
          countMap[c.pricing_tier_id] = (countMap[c.pricing_tier_id] || 0) + 1;
        }
      });

      return tiersData?.map((tier) => ({
        ...tier,
        customer_count: countMap[tier.id] || 0,
      })) as PricingTier[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (tier: typeof emptyTier) => {
      // If setting as default, first unset existing default
      if (tier.is_default) {
        await supabase
          .from('distribution_pricing_tiers')
          .update({ is_default: false })
          .eq('is_default', true);
      }
      
      const { error } = await supabase.from('distribution_pricing_tiers').insert({
        ...tier,
        sort_order: (tiers?.length || 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-pricing-tiers'] });
      toast.success('Pricing tier created');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create pricing tier');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...tier }: PricingTier) => {
      // If setting as default, first unset existing default
      if (tier.is_default) {
        await supabase
          .from('distribution_pricing_tiers')
          .update({ is_default: false })
          .neq('id', id);
      }
      
      const { error } = await supabase
        .from('distribution_pricing_tiers')
        .update({
          name: tier.name,
          description: tier.description,
          is_default: tier.is_default,
          is_active: tier.is_active,
          sort_order: tier.sort_order,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-pricing-tiers'] });
      toast.success('Pricing tier updated');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update pricing tier');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First, unassign customers from this tier
      await supabase
        .from('distribution_customers')
        .update({ pricing_tier_id: null })
        .eq('pricing_tier_id', id);
      
      const { error } = await supabase.from('distribution_pricing_tiers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-pricing-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-customers'] });
      toast.success('Pricing tier deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete pricing tier');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (tierId: string) => {
      // Unset existing default
      await supabase
        .from('distribution_pricing_tiers')
        .update({ is_default: false })
        .eq('is_default', true);
      
      // Set new default
      const { error } = await supabase
        .from('distribution_pricing_tiers')
        .update({ is_default: true })
        .eq('id', tierId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-pricing-tiers'] });
      toast.success('Default tier updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to set default tier');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('distribution_pricing_tiers')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-pricing-tiers'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update tier status');
    },
  });

  const resetForm = () => {
    setFormData(emptyTier);
    setEditingTier(null);
  };

  const handleEdit = (tier: PricingTier) => {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      description: tier.description || '',
      is_default: tier.is_default,
      is_active: tier.is_active,
      sort_order: tier.sort_order,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTier) {
      updateMutation.mutate({ id: editingTier.id, ...formData } as PricingTier);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fnb">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Pricing Tiers</h1>
            <p className="text-muted-foreground">
              Manage price rates for different customer types
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add Tier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingTier ? 'Edit Pricing Tier' : 'Add New Pricing Tier'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tier Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Wholesale, Hotel, VIP"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description of this pricing tier..."
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_default">Default Tier</Label>
                    <p className="text-xs text-muted-foreground">
                      Use for customers without an assigned tier
                    </p>
                  </div>
                  <Switch
                    id="is_default"
                    checked={formData.is_default}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_active">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Inactive tiers won't be available for selection
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingTier ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Pricing Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : tiers && tiers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Customers</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((tier) => (
                    <TableRow key={tier.id}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{tier.name}</span>
                          {tier.is_default && (
                            <Badge variant="secondary" className="gap-1">
                              <Star className="h-3 w-3" />
                              Default
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {tier.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />
                          {tier.customer_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={tier.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: tier.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!tier.is_default && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDefaultMutation.mutate(tier.id)}
                              title="Set as default"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(tier)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Pricing Tier?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove the "{tier.name}" tier and unassign {tier.customer_count} customer(s) from it. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(tier.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No pricing tiers yet. Click "Add Tier" to create your first one.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
