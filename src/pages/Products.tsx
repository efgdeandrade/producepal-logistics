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
  pack_size: z.number().int().min(1, 'Units per case must be at least 1'),
  supplier_id: z.string().uuid().optional().nullable(),
  case_size: z.string().trim().max(50, 'Case size too long').optional().nullable(),
  netto_weight_per_unit: z.number().min(0, 'Netto weight cannot be negative').optional().nullable(),
  gross_weight_per_unit: z.number().min(0, 'Gross weight cannot be negative').optional().nullable(),
  empty_case_weight: z.number().min(0, 'Empty case weight cannot be negative').optional().nullable(),
  price_usd_per_unit: z.number().min(0, 'Price cannot be negative').optional().nullable(),
  price_xcg_per_unit: z.number().min(0, 'Price cannot be negative').optional().nullable(),
  unit: z.string().trim().max(20, 'Unit too long').optional().nullable(),
});

interface Product {
  id: string;
  code: string;
  name: string;
  pack_size: number;
  supplier_id?: string | null;
  case_size?: string | null;
  netto_weight_per_unit?: number | null;
  gross_weight_per_unit?: number | null;
  empty_case_weight?: number | null;
  price_usd_per_unit?: number | null;
  price_xcg_per_unit?: number | null;
  unit?: string | null;
}


const Products = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const { logActivity } = useActivityLogger();
  const canManage = hasRole('admin') || hasRole('management');
  
  const [currencyRate, setCurrencyRate] = useState(1.82);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    pack_size: '',
    supplier_id: '',
    case_size: '',
    netto_weight_per_unit: '',
    gross_weight_per_unit: '',
    empty_case_weight: '',
    price_usd_per_unit: '',
    price_usd_per_case: '',
    price_xcg_per_unit: '',
    price_xcg_per_case: '',
    unit: '',
  });

  // Fetch currency conversion rate from settings
  useQuery({
    queryKey: ['currency-rate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'usd_to_xcg_rate')
        .single();
      
      if (error) {
        console.error('Failed to fetch currency rate:', error);
        return 1.82; // fallback
      }
      
      const rate = (data?.value as any)?.rate || 1.82;
      setCurrencyRate(rate);
      return rate;
    },
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
        case_size: values.case_size || null,
        netto_weight_per_unit: values.netto_weight_per_unit ? parseFloat(values.netto_weight_per_unit) : null,
        gross_weight_per_unit: values.gross_weight_per_unit ? parseFloat(values.gross_weight_per_unit) : null,
        empty_case_weight: values.empty_case_weight ? parseFloat(values.empty_case_weight) : null,
        price_usd_per_unit: values.price_usd_per_unit ? parseFloat(values.price_usd_per_unit) : null,
        price_xcg_per_unit: values.price_xcg_per_unit ? parseFloat(values.price_xcg_per_unit) : null,
        unit: values.unit || null,
      };
      
      const validated = productSchema.parse(parsed);
      
      const { data, error } = await supabase.from('products').insert([{
        code: validated.code,
        name: validated.name,
        pack_size: validated.pack_size,
        supplier_id: validated.supplier_id,
        case_size: validated.case_size,
        netto_weight_per_unit: validated.netto_weight_per_unit,
        gross_weight_per_unit: validated.gross_weight_per_unit,
        empty_case_weight: validated.empty_case_weight,
        price_usd_per_unit: validated.price_usd_per_unit,
        price_xcg_per_unit: validated.price_xcg_per_unit,
        unit: validated.unit,
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
      setFormData({ 
        code: '', name: '', pack_size: '', supplier_id: '', case_size: '',
        netto_weight_per_unit: '', gross_weight_per_unit: '', empty_case_weight: '',
        price_usd_per_unit: '', price_usd_per_case: '', price_xcg_per_unit: '', price_xcg_per_case: '', unit: '' 
      });
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
        case_size: values.case_size || null,
        netto_weight_per_unit: values.netto_weight_per_unit ? parseFloat(values.netto_weight_per_unit) : null,
        gross_weight_per_unit: values.gross_weight_per_unit ? parseFloat(values.gross_weight_per_unit) : null,
        empty_case_weight: values.empty_case_weight ? parseFloat(values.empty_case_weight) : null,
        price_usd_per_unit: values.price_usd_per_unit ? parseFloat(values.price_usd_per_unit) : null,
        price_xcg_per_unit: values.price_xcg_per_unit ? parseFloat(values.price_xcg_per_unit) : null,
        unit: values.unit || null,
      };
      
      const validated = productSchema.parse(parsed);
      
      const { error } = await supabase
        .from('products')
        .update({
          code: validated.code,
          name: validated.name,
          pack_size: validated.pack_size,
          supplier_id: validated.supplier_id,
          case_size: validated.case_size,
          netto_weight_per_unit: validated.netto_weight_per_unit,
          gross_weight_per_unit: validated.gross_weight_per_unit,
          empty_case_weight: validated.empty_case_weight,
          price_usd_per_unit: validated.price_usd_per_unit,
          price_xcg_per_unit: validated.price_xcg_per_unit,
          unit: validated.unit,
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
      const packSize = product.pack_size || 1;
      setFormData({
        code: product.code,
        name: product.name,
        pack_size: product.pack_size.toString(),
        supplier_id: product.supplier_id || '',
        case_size: product.case_size || '',
        netto_weight_per_unit: product.netto_weight_per_unit?.toString() || '',
        gross_weight_per_unit: product.gross_weight_per_unit?.toString() || '',
        empty_case_weight: product.empty_case_weight?.toString() || '',
        price_usd_per_unit: product.price_usd_per_unit?.toString() || '',
        price_usd_per_case: product.price_usd_per_unit ? (product.price_usd_per_unit * packSize).toFixed(2) : '',
        price_xcg_per_unit: product.price_xcg_per_unit?.toString() || '',
        price_xcg_per_case: product.price_xcg_per_unit ? (product.price_xcg_per_unit * packSize).toFixed(2) : '',
        unit: product.unit || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({ 
        code: '', name: '', pack_size: '', supplier_id: '', case_size: '',
        netto_weight_per_unit: '', gross_weight_per_unit: '', empty_case_weight: '',
        price_usd_per_unit: '', price_usd_per_case: '', price_xcg_per_unit: '', price_xcg_per_case: '', unit: '' 
      });
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
                        placeholder="e.g., BLB_125"
                        disabled={!!editingProduct}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Product Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Blueberries 125g"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pack_size">Units/Case *</Label>
                      <Input
                        id="pack_size"
                        type="number"
                        value={formData.pack_size}
                        onChange={(e) => {
                          const newPackSize = e.target.value;
                          const packSizeNum = parseFloat(newPackSize) || 1;
                          const pricePerUnit = parseFloat(formData.price_usd_per_unit) || 0;
                          const pricePerUnitXcg = parseFloat(formData.price_xcg_per_unit) || 0;
                          setFormData({ 
                            ...formData, 
                            pack_size: newPackSize,
                            price_usd_per_case: pricePerUnit ? (pricePerUnit * packSizeNum).toFixed(2) : '',
                            price_xcg_per_case: pricePerUnitXcg ? (pricePerUnitXcg * packSizeNum).toFixed(2) : ''
                          });
                        }}
                        placeholder="12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="case_size">Case Size</Label>
                      <Input
                        id="case_size"
                        value={formData.case_size}
                        onChange={(e) => setFormData({ ...formData, case_size: e.target.value })}
                        placeholder="e.g., 40x30x20cm"
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

                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="netto_weight_per_unit">Netto Weight/Unit</Label>
                      <Input
                        id="netto_weight_per_unit"
                        type="number"
                        step="0.01"
                        value={formData.netto_weight_per_unit}
                        onChange={(e) => setFormData({ ...formData, netto_weight_per_unit: e.target.value })}
                        placeholder="125"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gross_weight_per_unit">Gross Weight/Unit</Label>
                      <Input
                        id="gross_weight_per_unit"
                        type="number"
                        step="0.01"
                        value={formData.gross_weight_per_unit}
                        onChange={(e) => setFormData({ ...formData, gross_weight_per_unit: e.target.value })}
                        placeholder="130"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="empty_case_weight">Empty Case Weight</Label>
                      <Input
                        id="empty_case_weight"
                        type="number"
                        step="0.01"
                        value={formData.empty_case_weight}
                        onChange={(e) => setFormData({ ...formData, empty_case_weight: e.target.value })}
                        placeholder="500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Input
                        id="unit"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="g, kg, lb"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Price USD</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price_usd_per_unit">Per Unit</Label>
                        <Input
                          id="price_usd_per_unit"
                          type="number"
                          step="0.01"
                          value={formData.price_usd_per_unit}
                          onChange={(e) => {
                            const pricePerUnit = parseFloat(e.target.value) || 0;
                            const pricePerCase = pricePerUnit * (formData.pack_size ? parseFloat(formData.pack_size) : 1);
                            const xcgPerUnit = pricePerUnit * currencyRate;
                            const xcgPerCase = pricePerCase * currencyRate;
                            setFormData({
                              ...formData,
                              price_usd_per_unit: e.target.value,
                              price_usd_per_case: pricePerCase.toFixed(2),
                              price_xcg_per_unit: xcgPerUnit.toFixed(2),
                              price_xcg_per_case: xcgPerCase.toFixed(2),
                            });
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price_usd_per_case">Per Case</Label>
                        <Input
                          id="price_usd_per_case"
                          type="number"
                          step="0.01"
                          value={formData.price_usd_per_case}
                          onChange={(e) => {
                            const pricePerCase = parseFloat(e.target.value) || 0;
                            const packSize = parseFloat(formData.pack_size) || 1;
                            const pricePerUnit = pricePerCase / packSize;
                            const xcgPerUnit = pricePerUnit * currencyRate;
                            const xcgPerCase = pricePerCase * currencyRate;
                            setFormData({
                              ...formData,
                              price_usd_per_case: e.target.value,
                              price_usd_per_unit: pricePerUnit.toFixed(4),
                              price_xcg_per_unit: xcgPerUnit.toFixed(2),
                              price_xcg_per_case: xcgPerCase.toFixed(2),
                            });
                          }}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Price XCG</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price_xcg_per_unit">Per Unit</Label>
                        <Input
                          id="price_xcg_per_unit"
                          type="number"
                          step="0.01"
                          value={formData.price_xcg_per_unit}
                          onChange={(e) => {
                            const pricePerUnit = parseFloat(e.target.value) || 0;
                            const packSize = parseFloat(formData.pack_size) || 1;
                            const pricePerCase = pricePerUnit * packSize;
                            const usdPerUnit = pricePerUnit / currencyRate;
                            const usdPerCase = pricePerCase / currencyRate;
                            setFormData({
                              ...formData,
                              price_xcg_per_unit: e.target.value,
                              price_xcg_per_case: pricePerCase.toFixed(2),
                              price_usd_per_unit: usdPerUnit.toFixed(4),
                              price_usd_per_case: usdPerCase.toFixed(4),
                            });
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price_xcg_per_case">Per Case</Label>
                        <Input
                          id="price_xcg_per_case"
                          type="number"
                          step="0.01"
                          value={formData.price_xcg_per_case}
                          onChange={(e) => {
                            const pricePerCase = parseFloat(e.target.value) || 0;
                            const packSize = parseFloat(formData.pack_size) || 1;
                            const pricePerUnit = pricePerCase / packSize;
                            const usdPerUnit = pricePerUnit / currencyRate;
                            const usdPerCase = pricePerCase / currencyRate;
                            setFormData({
                              ...formData,
                              price_xcg_per_case: e.target.value,
                              price_xcg_per_unit: pricePerUnit.toFixed(4),
                              price_usd_per_unit: usdPerUnit.toFixed(4),
                              price_usd_per_case: usdPerCase.toFixed(4),
                            });
                          }}
                          placeholder="0.00"
                        />
                      </div>
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
                  {product.netto_weight_per_unit && product.unit ? (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Unit Size:</span> {product.netto_weight_per_unit} {product.unit}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Unit Size:</span> -
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    <span className="font-medium">Units per Case:</span> {product.pack_size}
                  </p>
                  {product.case_size && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Case Size:</span> {product.case_size}
                    </p>
                  )}
                  {product.gross_weight_per_unit && product.unit && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Gross Weight/Unit:</span> {product.gross_weight_per_unit} {product.unit}
                    </p>
                  )}
                  {product.empty_case_weight && product.unit && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Empty Case Weight:</span> {product.empty_case_weight} {product.unit}
                    </p>
                  )}
                  {product.price_usd_per_unit && (
                    <>
                      <p className="text-muted-foreground">
                        <span className="font-medium">Price USD:</span> ${product.price_usd_per_unit.toFixed(2)}/unit
                      </p>
                      <p className="text-muted-foreground text-sm">
                        <span className="font-medium">Price per case:</span> ${(product.price_usd_per_unit * product.pack_size).toFixed(2)}
                      </p>
                    </>
                  )}
                  {product.price_xcg_per_unit && (
                    <>
                      <p className="text-muted-foreground">
                        <span className="font-medium">Price XCG:</span> {product.price_xcg_per_unit.toFixed(2)}/unit
                      </p>
                      <p className="text-muted-foreground text-sm">
                        <span className="font-medium">Price per case:</span> {(product.price_xcg_per_unit * product.pack_size).toFixed(2)}
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
