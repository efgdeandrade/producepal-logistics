import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Plus, Edit, Trash2, ArrowLeft, Search, Store, ShoppingBag } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useActivityLogger } from '@/hooks/useActivityLogger';

interface Customer {
  id: string;
  name: string;
  address: string;
  city?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  pricing_tier: 'wholesale' | 'retail';
}

export default function Customers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLogger();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const canManage = canCreate('data') || canUpdate('data');

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Customer[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: { name: string; address: string; city?: string; postal_code?: string; phone?: string; email?: string; notes?: string; pricing_tier: 'wholesale' | 'retail' }) => {
      // Convert empty strings to null for optional fields
      const cleanedValues = {
        name: values.name,
        address: values.address,
        city: values.city || null,
        postal_code: values.postal_code || null,
        phone: values.phone || null,
        email: values.email || null,
        notes: values.notes || null,
        pricing_tier: values.pricing_tier,
      };
      
      const { data, error } = await supabase.from('customers').insert([cleanedValues]).select().single();
      if (error) {
        console.error('Customer creation error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      logActivity('create_customer', 'customer', data.id, { name: data.name });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Customer created successfully' });
      setDialogOpen(false);
      setEditingCustomer(null);
    },
    onError: (error: Error) => {
      console.error('Full error:', error);
      toast({ title: 'Error creating customer', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: Partial<Customer> & { id: string }) => {
      // Convert empty strings to null for optional fields
      const cleanedValues = {
        ...values,
        city: values.city || null,
        postal_code: values.postal_code || null,
        phone: values.phone || null,
        email: values.email || null,
        notes: values.notes || null,
        pricing_tier: values.pricing_tier,
      };
      
      const { error } = await supabase
        .from('customers')
        .update(cleanedValues)
        .eq('id', id);
      if (error) {
        console.error('Customer update error:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      logActivity('update_customer', 'customer', variables.id);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Customer updated successfully' });
      setDialogOpen(false);
      setEditingCustomer(null);
    },
    onError: (error: Error) => {
      console.error('Full error:', error);
      toast({ title: 'Error updating customer', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      logActivity('delete_customer', 'customer', id);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Customer deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting customer', description: error.message, variant: 'destructive' });
    },
  });

  const [selectedPricingTier, setSelectedPricingTier] = useState<'wholesale' | 'retail'>('wholesale');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const values = {
      name: formData.get('name') as string,
      address: formData.get('address') as string,
      city: formData.get('city') as string,
      postal_code: formData.get('postal_code') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      notes: formData.get('notes') as string,
      pricing_tier: selectedPricingTier,
    };

    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold flex-1">Customers</h1>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedPricingTier('wholesale');
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingCustomer(null);
                setSelectedPricingTier('wholesale');
              }}>
                <Plus className="mr-2 h-4 w-4" /> Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      required
                      defaultValue={editingCustomer?.name}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      defaultValue={editingCustomer?.phone}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    name="address"
                    required
                    defaultValue={editingCustomer?.address}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      defaultValue={editingCustomer?.city}
                    />
                  </div>
                  <div>
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      name="postal_code"
                      defaultValue={editingCustomer?.postal_code}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={editingCustomer?.email}
                  />
                </div>
                <div>
                  <Label htmlFor="pricing_tier">Pricing Tier</Label>
                  <Select 
                    value={selectedPricingTier} 
                    onValueChange={(value: 'wholesale' | 'retail') => setSelectedPricingTier(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pricing tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wholesale">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4" />
                          <span>Wholesale</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="retail">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4" />
                          <span>Retail</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Wholesale: resellers get wholesale pricing. Retail: end customers pay retail prices.
                  </p>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    defaultValue={editingCustomer?.notes}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingCustomer ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers by name, address, city, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : customers && customers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No customers found. Add your first customer to get started.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                {canManage && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers
                ?.filter((customer) => {
                  const query = searchQuery.toLowerCase();
                  return (
                    customer.name.toLowerCase().includes(query) ||
                    customer.address.toLowerCase().includes(query) ||
                    customer.city?.toLowerCase().includes(query) ||
                    customer.phone?.toLowerCase().includes(query) ||
                    customer.email?.toLowerCase().includes(query)
                  );
                })
                .map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={customer.pricing_tier === 'retail' ? 'default' : 'secondary'}
                      className="flex items-center gap-1 w-fit"
                    >
                      {customer.pricing_tier === 'retail' ? (
                        <><ShoppingBag className="h-3 w-3" /> Retail</>
                      ) : (
                        <><Store className="h-3 w-3" /> Wholesale</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {customer.address}
                    </div>
                  </TableCell>
                  <TableCell>{customer.city}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.email}</TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingCustomer(customer);
                            setSelectedPricingTier(customer.pricing_tier || 'wholesale');
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this customer?')) {
                              deleteMutation.mutate(customer.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
