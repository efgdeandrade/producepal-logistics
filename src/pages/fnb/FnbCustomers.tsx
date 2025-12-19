import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, ArrowLeft, Search, MessageSquare, Route } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CustomerType = "regular" | "supermarket" | "cod" | "credit";

interface FnbCustomer {
  id: string;
  name: string;
  whatsapp_phone: string;
  preferred_language: string;
  address: string | null;
  delivery_zone: string | null;
  customer_type: CustomerType;
  notes: string | null;
}

const emptyCustomer: Omit<FnbCustomer, 'id'> = {
  name: '',
  whatsapp_phone: '',
  preferred_language: 'pap',
  address: '',
  delivery_zone: '',
  customer_type: 'regular',
  notes: '',
};

const languageLabels: Record<string, string> = {
  pap: 'Papiamento',
  en: 'English',
  nl: 'Dutch',
  es: 'Spanish',
};

const customerTypeLabels: Record<CustomerType, string> = {
  regular: 'Regular',
  supermarket: 'Supermarket (Receipt Required)',
  cod: 'COD (Cash on Delivery)',
  credit: 'Credit Account',
};

export default function FnbCustomers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<FnbCustomer | null>(null);
  const [formData, setFormData] = useState<Omit<FnbCustomer, 'id'>>(emptyCustomer);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['fnb-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_customers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as FnbCustomer[];
    },
  });

  // Fetch delivery zones from database
  const { data: deliveryZones } = useQuery({
    queryKey: ['fnb-delivery-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_delivery_zones')
        .select('name')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data?.map(z => z.name) || [];
    },
  });

  const allZones = deliveryZones || [];

  const createMutation = useMutation({
    mutationFn: async (customer: Omit<FnbCustomer, 'id'>) => {
      const { error } = await supabase.from('fnb_customers').insert(customer);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-customers'] });
      toast.success('Customer created');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create customer');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...customer }: FnbCustomer) => {
      const { error } = await supabase.from('fnb_customers').update(customer).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-customers'] });
      toast.success('Customer updated');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update customer');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fnb_customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-customers'] });
      toast.success('Customer deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete customer');
    },
  });

  const resetForm = () => {
    setFormData(emptyCustomer);
    setEditingCustomer(null);
  };

  const handleEdit = (customer: FnbCustomer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      whatsapp_phone: customer.whatsapp_phone,
      preferred_language: customer.preferred_language,
      address: customer.address || '',
      delivery_zone: customer.delivery_zone || '',
      customer_type: customer.customer_type || 'regular',
      notes: customer.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredCustomers = customers?.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.whatsapp_phone.includes(searchTerm);
    const matchesZone = zoneFilter === 'all' || 
      (zoneFilter === 'unassigned' ? !c.delivery_zone : c.delivery_zone === zoneFilter);
    return matchesSearch && matchesZone;
  });

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
            <h1 className="text-3xl font-bold tracking-tight">F&B Customers</h1>
            <p className="text-muted-foreground">
              Manage F&B customers and delivery zones
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Restaurant Name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp_phone">WhatsApp Phone</Label>
                  <Input
                    id="whatsapp_phone"
                    value={formData.whatsapp_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, whatsapp_phone: e.target.value })
                    }
                    placeholder="+5999XXXXXXX"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Include country code (e.g., +5999 for Curaçao)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="preferred_language">Preferred Language</Label>
                    <Select
                      value={formData.preferred_language}
                      onValueChange={(value) =>
                        setFormData({ ...formData, preferred_language: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pap">Papiamento</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="nl">Dutch</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delivery_zone">Delivery Zone</Label>
                    <Select
                      value={formData.delivery_zone || ''}
                      onValueChange={(value) =>
                        setFormData({ ...formData, delivery_zone: value || null })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {allZones.map((zone) => (
                          <SelectItem key={zone} value={zone}>
                            {zone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer_type">Customer Type</Label>
                    <Select
                      value={formData.customer_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, customer_type: value as CustomerType })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="supermarket">Supermarket (Receipt Required)</SelectItem>
                        <SelectItem value="cod">COD (Cash on Delivery)</SelectItem>
                        <SelectItem value="credit">Credit Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Delivery address..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Special instructions, preferences..."
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingCustomer ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {allZones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading customers...</p>
            ) : filteredCustomers && filteredCustomers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                          {customer.whatsapp_phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.delivery_zone ? (
                          <Badge variant="secondary" className="text-xs">
                            <Route className="h-3 w-3 mr-1" />
                            {customer.delivery_zone}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>{languageLabels[customer.preferred_language]}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {customer.address || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(customer)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Delete this customer?')) {
                                deleteMutation.mutate(customer.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No customers found. Customers will be auto-created when they message via
                WhatsApp, or you can add them manually.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
