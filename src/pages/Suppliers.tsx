import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { PlusCircle, Pencil, Trash2, ArrowLeft, Search, Package, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name too long'),
  contact: z.string().trim().max(200, 'Contact name too long').optional(),
  email: z.string().trim().email('Invalid email').max(255, 'Email too long').optional().or(z.literal('')),
  phone: z.string().trim().max(50, 'Phone too long').optional(),
});

interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
}

interface SupplierOrder {
  id: string;
  order_number: string;
  order_date: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  total_amount: number;
  notes?: string;
}

interface SupplierOrderItem {
  id: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}


const Suppliers = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const { logActivity } = useActivityLogger();
  const canManage = hasRole('admin') || hasRole('management');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<Omit<Supplier, 'id'>>({
    name: '',
    contact: '',
    email: '',
    phone: '',
  });

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: supplierOrders } = useQuery({
    queryKey: ['supplier-orders', viewingSupplier?.id],
    queryFn: async () => {
      if (!viewingSupplier) return [];
      const { data, error } = await supabase
        .from('supplier_orders')
        .select('*')
        .eq('supplier_id', viewingSupplier.id)
        .order('order_date', { ascending: false });
      if (error) throw error;
      return data as SupplierOrder[];
    },
    enabled: !!viewingSupplier,
  });

  const createMutation = useMutation({
    mutationFn: async (values: Omit<Supplier, 'id'>) => {
      const validated = supplierSchema.parse(values);
      const cleanedValues = {
        name: validated.name,
        contact: validated.contact || null,
        email: validated.email || null,
        phone: validated.phone || null,
      };
      
      const { data, error } = await supabase.from('suppliers').insert([cleanedValues]).select().single();
      if (error) {
        console.error('Supplier creation error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      logActivity('create_supplier', 'supplier', data.id, { name: data.name });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Supplier added successfully' });
      setIsDialogOpen(false);
      setFormData({ name: '', contact: '', email: '', phone: '' });
    },
    onError: (error: Error) => {
      console.error('Full error:', error);
      toast({ title: 'Error adding supplier', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: Supplier) => {
      const validated = supplierSchema.parse(values);
      const cleanedValues = {
        name: validated.name,
        contact: validated.contact || null,
        email: validated.email || null,
        phone: validated.phone || null,
      };
      
      const { error } = await supabase
        .from('suppliers')
        .update(cleanedValues)
        .eq('id', id);
      if (error) {
        console.error('Supplier update error:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      logActivity('update_supplier', 'supplier', variables.id);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Supplier updated successfully' });
      setIsDialogOpen(false);
      setEditingSupplier(null);
    },
    onError: (error: Error) => {
      console.error('Full error:', error);
      toast({ title: 'Error updating supplier', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      logActivity('delete_supplier', 'supplier', id);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Supplier deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting supplier', description: error.message, variant: 'destructive' });
    },
  });


  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contact: supplier.contact || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
      });
    } else {
      setEditingSupplier(null);
      setFormData({ name: '', contact: '', email: '', phone: '' });
    }
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      pending: "secondary",
      confirmed: "default",
      delivered: "outline",
      cancelled: "destructive",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleSave = () => {
    try {
      if (editingSupplier) {
        updateMutation.mutate({ id: editingSupplier.id, ...formData });
      } else {
        createMutation.mutate(formData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ 
          title: 'Validation Error', 
          description: error.errors[0].message, 
          variant: 'destructive' 
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-6">
          <div>Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="mr-4">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground mb-2">Suppliers</h1>
            <p className="text-muted-foreground">Manage your supplier contacts and information</p>
          </div>
          {canManage && (
            <div className="ml-auto">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Supplier
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Supplier Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter supplier name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">Contact Person</Label>
                    <Input
                      id="contact"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      placeholder="Enter contact name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    {editingSupplier ? 'Update' : 'Add'} Supplier
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          )}
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers by name, contact, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {viewingSupplier ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{viewingSupplier.name}</CardTitle>
                  {viewingSupplier.contact && (
                    <CardDescription>{viewingSupplier.contact}</CardDescription>
                  )}
                </div>
                <Button variant="outline" onClick={() => setViewingSupplier(null)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to All Suppliers
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="info">
                <TabsList>
                  <TabsTrigger value="info">Supplier Information</TabsTrigger>
                  <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
                </TabsList>
                
                <TabsContent value="info" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {viewingSupplier.email && (
                      <div>
                        <Label className="text-muted-foreground">Email</Label>
                        <p className="text-lg">{viewingSupplier.email}</p>
                      </div>
                    )}
                    {viewingSupplier.phone && (
                      <div>
                        <Label className="text-muted-foreground">Phone</Label>
                        <p className="text-lg">{viewingSupplier.phone}</p>
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex gap-2 pt-4">
                      <Button onClick={() => handleOpenDialog(viewingSupplier)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Supplier
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="orders">
                  {supplierOrders && supplierOrders.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order #</TableHead>
                            <TableHead>Order Date</TableHead>
                            <TableHead>Expected Delivery</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {supplierOrders.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell className="font-medium">{order.order_number}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {format(new Date(order.order_date), 'MMM dd, yyyy')}
                                </div>
                              </TableCell>
                              <TableCell>
                                {order.expected_delivery_date ? (
                                  format(new Date(order.expected_delivery_date), 'MMM dd, yyyy')
                                ) : (
                                  <span className="text-muted-foreground">Not set</span>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell className="text-right">
                                cg {order.total_amount.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No purchase orders found for this supplier.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : suppliers && suppliers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No suppliers found. Add your first supplier to get started.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {suppliers
              ?.filter((supplier) => {
                const query = searchQuery.toLowerCase();
                return (
                  supplier.name.toLowerCase().includes(query) ||
                  supplier.contact?.toLowerCase().includes(query) ||
                  supplier.email?.toLowerCase().includes(query) ||
                  supplier.phone?.toLowerCase().includes(query)
                );
              })
              .map((supplier) => (
            <Card key={supplier.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>{supplier.name}</CardTitle>
                {supplier.contact && (
                  <CardDescription>{supplier.contact}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm mb-4">
                  {supplier.email && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Email:</span> {supplier.email}
                    </p>
                  )}
                  {supplier.phone && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Phone:</span> {supplier.phone}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setViewingSupplier(supplier)}
                  >
                    <Package className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDialog(supplier);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this supplier?')) {
                            deleteMutation.mutate(supplier.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Suppliers;
