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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Pencil, Trash2, ArrowLeft, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

const productSchema = z.object({
  code: z.string().trim().min(1, 'Product code is required').max(50, 'Code too long'),
  name: z.string().trim().min(1, 'Product name is required').max(200, 'Name too long'),
  pack_size: z.number().int().min(1, 'Pack size must be at least 1'),
  supplier_id: z.string().uuid().optional().nullable(),
  price_usd: z.number().min(0, 'Price cannot be negative').optional().nullable(),
  price_xcg: z.number().min(0, 'Price cannot be negative').optional().nullable(),
  weight: z.number().min(0, 'Weight cannot be negative').optional().nullable(),
  unit: z.string().trim().max(20, 'Unit too long').optional().nullable(),
});

interface Product {
  id: string;
  code: string;
  name: string;
  pack_size: number;
  supplier_id?: string | null;
  price_usd?: number | null;
  price_xcg?: number | null;
  weight?: number | null;
  unit?: string | null;
}


const Products = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const { logActivity } = useActivityLogger();
  const canManage = hasRole('admin') || hasRole('management');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    pack_size: '',
    supplier_id: '',
    price_usd: '',
    price_xcg: '',
    weight: '',
    unit: '',
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('code');
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof formData) => {
      const parsed = {
        code: values.code,
        name: values.name,
        pack_size: parseInt(values.pack_size),
        supplier_id: values.supplier_id || null,
        price_usd: values.price_usd ? parseFloat(values.price_usd) : null,
        price_xcg: values.price_xcg ? parseFloat(values.price_xcg) : null,
        weight: values.weight ? parseFloat(values.weight) : null,
        unit: values.unit || null,
      };
      
      const validated = productSchema.parse(parsed);
      
      const { data, error } = await supabase.from('products').insert([{
        code: validated.code,
        name: validated.name,
        pack_size: validated.pack_size,
        supplier_id: validated.supplier_id || null,
        price_usd: validated.price_usd || null,
        price_xcg: validated.price_xcg || null,
        weight: validated.weight || null,
        unit: validated.unit || null,
      }]).select().single();
      if (error) {
        console.error('Product creation error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      logActivity('create_product', 'product', data.id, { code: data.code, name: data.name });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // Invalidate supplier-specific products if this product has a supplier
      if (data.supplier_id) {
        queryClient.invalidateQueries({ queryKey: ['supplier-products', data.supplier_id] });
      }
      toast({ title: 'Product added successfully' });
      setIsDialogOpen(false);
      setFormData({ code: '', name: '', pack_size: '', supplier_id: '', price_usd: '', price_xcg: '', weight: '', unit: '' });
    },
    onError: (error: Error) => {
      console.error('Full error:', error);
      toast({ title: 'Error adding product', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & typeof formData) => {
      const parsed = {
        code: values.code,
        name: values.name,
        pack_size: parseInt(values.pack_size),
        supplier_id: values.supplier_id || null,
        price_usd: values.price_usd ? parseFloat(values.price_usd) : null,
        price_xcg: values.price_xcg ? parseFloat(values.price_xcg) : null,
        weight: values.weight ? parseFloat(values.weight) : null,
        unit: values.unit || null,
      };
      
      const validated = productSchema.parse(parsed);
      
      const { error } = await supabase
        .from('products')
        .update({
          code: validated.code,
          name: validated.name,
          pack_size: validated.pack_size,
          supplier_id: validated.supplier_id || null,
          price_usd: validated.price_usd || null,
          price_xcg: validated.price_xcg || null,
          weight: validated.weight || null,
          unit: validated.unit || null,
        })
        .eq('id', id);
      if (error) {
        console.error('Product update error:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      logActivity('update_product', 'product', variables.id);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // Invalidate all supplier-products queries since supplier might have changed
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      toast({ title: 'Product updated successfully' });
      setIsDialogOpen(false);
      setEditingProduct(null);
    },
    onError: (error: Error) => {
      console.error('Full error:', error);
      toast({ title: 'Error updating product', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      logActivity('delete_product', 'product', id);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // Invalidate all supplier-products queries since we don't know which supplier this belonged to
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      toast({ title: 'Product deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting product', description: error.message, variant: 'destructive' });
    },
  });


  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        code: product.code,
        name: product.name,
        pack_size: product.pack_size.toString(),
        supplier_id: product.supplier_id || '',
        price_usd: product.price_usd?.toString() || '',
        price_xcg: product.price_xcg?.toString() || '',
        weight: product.weight?.toString() || '',
        unit: product.unit || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({ code: '', name: '', pack_size: '', supplier_id: '', price_usd: '', price_xcg: '', weight: '', unit: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    try {
      if (editingProduct) {
        updateMutation.mutate({ id: editingProduct.id, ...formData });
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

  if (productsLoading) {
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Products</h1>
            <p className="text-muted-foreground">Manage your product catalog, pricing, and supplier information</p>
          </div>
          {canManage && (
            <div className="ml-auto">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="code">Product Code *</Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="e.g., STB_500"
                        disabled={!!editingProduct}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Product Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Strawberries 500g"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pack_size">Pack Size (units per tray) *</Label>
                      <Input
                        id="pack_size"
                        type="number"
                        value={formData.pack_size}
                        onChange={(e) => setFormData({ ...formData, pack_size: e.target.value })}
                        placeholder="e.g., 10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplier">Supplier</Label>
                      <Select
                        value={formData.supplier_id}
                        onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                      >
                        <SelectTrigger id="supplier">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers?.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price_usd">Price USD</Label>
                      <Input
                        id="price_usd"
                        type="number"
                        step="0.01"
                        value={formData.price_usd}
                        onChange={(e) => setFormData({ ...formData, price_usd: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price_xcg">Price XCG</Label>
                      <Input
                        id="price_xcg"
                        type="number"
                        step="0.01"
                        value={formData.price_xcg}
                        onChange={(e) => setFormData({ ...formData, price_xcg: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="weight">Weight</Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.01"
                        value={formData.weight}
                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Input
                        id="unit"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="e.g., kg, g"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    {editingProduct ? 'Update' : 'Add'} Product
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
              placeholder="Search products by code, name, or supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {products && products.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No products found. Add your first product to get started.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products
              ?.filter((product) => {
                const query = searchQuery.toLowerCase();
                const supplierName = suppliers?.find(s => s.id === product.supplier_id)?.name?.toLowerCase() || '';
                return (
                  product.code.toLowerCase().includes(query) ||
                  product.name.toLowerCase().includes(query) ||
                  supplierName.includes(query)
                );
              })
              .map((product) => (
            <Card key={product.id}>
              <CardHeader>
                <CardTitle>{product.name}</CardTitle>
                <CardDescription>Code: {product.code}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm mb-4">
                  {product.weight && product.unit ? (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Unit Size:</span> {product.weight} {product.unit}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Unit Size:</span> -
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    <span className="font-medium">Units per Case:</span> {product.pack_size}
                  </p>
                  {product.price_usd && (
                    <>
                      <p className="text-muted-foreground">
                        <span className="font-medium">Price USD:</span> ${product.price_usd.toFixed(2)}/case
                      </p>
                      <p className="text-muted-foreground text-sm">
                        <span className="font-medium">Price per unit:</span> ${(product.price_usd / product.pack_size).toFixed(2)}
                      </p>
                    </>
                  )}
                  {product.price_xcg && (
                    <>
                      <p className="text-muted-foreground">
                        <span className="font-medium">Price XCG:</span> cg {product.price_xcg.toFixed(2)}/case
                      </p>
                      <p className="text-muted-foreground text-sm">
                        <span className="font-medium">Price per unit:</span> cg {(product.price_xcg / product.pack_size).toFixed(2)}
                      </p>
                    </>
                  )}
                  {product.supplier_id && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Supplier:</span> {
                        suppliers?.find(s => s.id === product.supplier_id)?.name || 'Unknown'
                      }
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {canManage && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(product)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this product?')) {
                            deleteMutation.mutate(product.id);
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

export default Products;
