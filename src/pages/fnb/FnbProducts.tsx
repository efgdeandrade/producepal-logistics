import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, ArrowLeft, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Switch } from '@/components/ui/switch';

interface FnbProduct {
  id: string;
  code: string;
  name: string;
  name_pap: string | null;
  name_nl: string | null;
  name_es: string | null;
  unit: string;
  price_xcg: number;
  min_order_qty: number;
  is_active: boolean;
  is_weight_based: boolean;
  weight_unit: string;
  // Unit pricing
  price_per_kg: number | null;
  price_per_gram: number | null;
  price_per_lb: number | null;
  price_per_case: number | null;
  price_per_piece: number | null;
  price_per_tros: number | null;
  items_per_case: number | null;
  case_weight_kg: number | null;
  product_description: string | null;
}

const emptyProduct: Omit<FnbProduct, 'id'> = {
  code: '',
  name: '',
  name_pap: '',
  name_nl: '',
  name_es: '',
  unit: 'kg',
  price_xcg: 0,
  min_order_qty: 1,
  is_active: true,
  is_weight_based: false,
  weight_unit: 'kg',
  price_per_kg: null,
  price_per_gram: null,
  price_per_lb: null,
  price_per_case: null,
  price_per_piece: null,
  price_per_tros: null,
  items_per_case: null,
  case_weight_kg: null,
  product_description: null,
};

interface TierPrice {
  tier_id: string;
  tier_name: string;
  price_xcg: number | null;
}

export default function FnbProducts() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FnbProduct | null>(null);
  const [formData, setFormData] = useState<Omit<FnbProduct, 'id'>>(emptyProduct);
  const [tierPrices, setTierPrices] = useState<TierPrice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ['fnb-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_products')
        .select('*')
        .order('code');
      if (error) throw error;
      return data as FnbProduct[];
    },
  });

  // Fetch pricing tiers
  const { data: pricingTiers } = useQuery({
    queryKey: ['fnb-pricing-tiers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_pricing_tiers')
        .select('id, name, is_default')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (product: Omit<FnbProduct, 'id'>) => {
      const { error } = await supabase.from('fnb_products').insert(product);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-products'] });
      toast.success('Product created');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create product');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...product }: FnbProduct) => {
      const { error } = await supabase.from('fnb_products').update(product).eq('id', id);
      if (error) throw error;
      
      // Save tier prices
      await saveTierPrices(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-products'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-product-tier-prices'] });
      toast.success('Product updated');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update product');
    },
  });

  const saveTierPrices = async (productId: string) => {
    // Delete existing tier prices for this product
    await supabase
      .from('fnb_product_tier_prices')
      .delete()
      .eq('product_id', productId);
    
    // Insert new tier prices (only those with values)
    const pricesToInsert = tierPrices
      .filter(tp => tp.price_xcg !== null && tp.price_xcg > 0)
      .map(tp => ({
        product_id: productId,
        tier_id: tp.tier_id,
        price_xcg: tp.price_xcg,
      }));
    
    if (pricesToInsert.length > 0) {
      const { error } = await supabase
        .from('fnb_product_tier_prices')
        .insert(pricesToInsert);
      if (error) throw error;
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fnb_products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-products'] });
      toast.success('Product deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete product');
    },
  });

  const resetForm = () => {
    setFormData(emptyProduct);
    setEditingProduct(null);
    // Initialize tier prices from available tiers
    if (pricingTiers) {
      setTierPrices(pricingTiers.map(tier => ({
        tier_id: tier.id,
        tier_name: tier.name,
        price_xcg: null,
      })));
    } else {
      setTierPrices([]);
    }
  };

  const handleEdit = async (product: FnbProduct) => {
    setEditingProduct(product);
    setFormData({
      code: product.code,
      name: product.name,
      name_pap: product.name_pap || '',
      name_nl: product.name_nl || '',
      name_es: product.name_es || '',
      unit: product.unit,
      price_xcg: product.price_xcg,
      min_order_qty: product.min_order_qty,
      is_active: product.is_active,
      is_weight_based: product.is_weight_based ?? false,
      weight_unit: product.weight_unit || 'kg',
      price_per_kg: product.price_per_kg,
      price_per_gram: product.price_per_gram,
      price_per_lb: product.price_per_lb,
      price_per_case: product.price_per_case,
      price_per_piece: product.price_per_piece,
      price_per_tros: product.price_per_tros,
      items_per_case: product.items_per_case,
      case_weight_kg: product.case_weight_kg,
      product_description: product.product_description,
    });
    
    // Fetch existing tier prices for this product
    const { data: existingPrices } = await supabase
      .from('fnb_product_tier_prices')
      .select('tier_id, price_xcg')
      .eq('product_id', product.id);
    
    // Map to tier prices with all available tiers
    if (pricingTiers) {
      const priceMap = new Map(existingPrices?.map(p => [p.tier_id, p.price_xcg]) || []);
      setTierPrices(pricingTiers.map(tier => ({
        tier_id: tier.id,
        tier_name: tier.name,
        price_xcg: priceMap.get(tier.id) ?? null,
      })));
    }
    
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredProducts = products?.filter(
    (p) =>
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <h1 className="text-3xl font-bold tracking-tight">F&B Products</h1>
            <p className="text-muted-foreground">
              Manage your F&B product catalog with multilingual names for AI matching
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg h-[85vh] max-h-[85vh] flex flex-col overflow-hidden">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 min-h-0 pr-4">
                <form id="product-form" onSubmit={handleSubmit} className="space-y-4 pb-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Product Code</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="STB_500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => setFormData({ ...formData, unit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">grams</SelectItem>
                        <SelectItem value="piece">piece</SelectItem>
                        <SelectItem value="box">box</SelectItem>
                        <SelectItem value="tray">tray</SelectItem>
                        <SelectItem value="tros">tros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Name (English)</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Strawberries 500g"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name_pap">Name (Papiamento)</Label>
                  <Input
                    id="name_pap"
                    value={formData.name_pap || ''}
                    onChange={(e) => setFormData({ ...formData, name_pap: e.target.value })}
                    placeholder="Strawberry 500g"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name_nl">Name (Dutch)</Label>
                    <Input
                      id="name_nl"
                      value={formData.name_nl || ''}
                      onChange={(e) => setFormData({ ...formData, name_nl: e.target.value })}
                      placeholder="Aardbeien 500g"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name_es">Name (Spanish)</Label>
                    <Input
                      id="name_es"
                      value={formData.name_es || ''}
                      onChange={(e) => setFormData({ ...formData, name_es: e.target.value })}
                      placeholder="Fresas 500g"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price_xcg">Default Price (XCG)</Label>
                    <Input
                      id="price_xcg"
                      type="number"
                      step="0.01"
                      value={formData.price_xcg}
                      onChange={(e) =>
                        setFormData({ ...formData, price_xcg: parseFloat(e.target.value) || 0 })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min_order_qty">Min Order Qty</Label>
                    <Input
                      id="min_order_qty"
                      type="number"
                      step="0.1"
                      value={formData.min_order_qty}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          min_order_qty: parseFloat(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Unit Pricing Section */}
                <div className="p-3 border rounded-lg bg-muted/50 space-y-3">
                  <p className="text-sm font-medium">Unit Pricing (optional)</p>
                  <p className="text-xs text-muted-foreground">
                    Set specific prices for different units. When ordering, the price will auto-update based on unit selection.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="price_per_kg" className="text-xs">Per Kg</Label>
                      <Input
                        id="price_per_kg"
                        type="number"
                        step="0.01"
                        value={formData.price_per_kg ?? ''}
                        onChange={(e) =>
                          setFormData({ ...formData, price_per_kg: e.target.value ? parseFloat(e.target.value) : null })
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="price_per_gram" className="text-xs">Per Gram</Label>
                      <Input
                        id="price_per_gram"
                        type="number"
                        step="0.01"
                        value={formData.price_per_gram ?? ''}
                        onChange={(e) =>
                          setFormData({ ...formData, price_per_gram: e.target.value ? parseFloat(e.target.value) : null })
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="price_per_lb" className="text-xs">Per Lb</Label>
                      <Input
                        id="price_per_lb"
                        type="number"
                        step="0.01"
                        value={formData.price_per_lb ?? ''}
                        onChange={(e) =>
                          setFormData({ ...formData, price_per_lb: e.target.value ? parseFloat(e.target.value) : null })
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="price_per_case" className="text-xs">Per Case</Label>
                      <Input
                        id="price_per_case"
                        type="number"
                        step="0.01"
                        value={formData.price_per_case ?? ''}
                        onChange={(e) =>
                          setFormData({ ...formData, price_per_case: e.target.value ? parseFloat(e.target.value) : null })
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="price_per_piece" className="text-xs">Per Piece</Label>
                      <Input
                        id="price_per_piece"
                        type="number"
                        step="0.01"
                        value={formData.price_per_piece ?? ''}
                        onChange={(e) =>
                          setFormData({ ...formData, price_per_piece: e.target.value ? parseFloat(e.target.value) : null })
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="price_per_tros" className="text-xs">Per Tros</Label>
                      <Input
                        id="price_per_tros"
                        type="number"
                        step="0.01"
                        value={formData.price_per_tros ?? ''}
                        onChange={(e) =>
                          setFormData({ ...formData, price_per_tros: e.target.value ? parseFloat(e.target.value) : null })
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Case Information Section */}
                <div className="p-3 border rounded-lg bg-muted/50 space-y-3">
                  <p className="text-sm font-medium">Case Information (optional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="items_per_case" className="text-xs">Items per Case</Label>
                      <Input
                        id="items_per_case"
                        type="number"
                        step="1"
                        value={formData.items_per_case ?? ''}
                        onChange={(e) =>
                          setFormData({ ...formData, items_per_case: e.target.value ? parseInt(e.target.value) : null })
                        }
                        placeholder="e.g., 12"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="case_weight_kg" className="text-xs">Case Weight (kg)</Label>
                      <Input
                        id="case_weight_kg"
                        type="number"
                        step="0.01"
                        value={formData.case_weight_kg ?? ''}
                        onChange={(e) =>
                          setFormData({ ...formData, case_weight_kg: e.target.value ? parseFloat(e.target.value) : null })
                        }
                        placeholder="e.g., 6.5"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="product_description" className="text-xs">Product Description</Label>
                    <Input
                      id="product_description"
                      value={formData.product_description ?? ''}
                      onChange={(e) =>
                        setFormData({ ...formData, product_description: e.target.value || null })
                      }
                      placeholder="Additional product details..."
                    />
                  </div>
                </div>

                {/* Tier Pricing Section */}
                {tierPrices.length > 0 && (
                  <div className="p-3 border rounded-lg bg-muted/50 space-y-3">
                    <p className="text-sm font-medium">Tier Pricing (optional)</p>
                    <p className="text-xs text-muted-foreground">
                      Set specific prices for different customer tiers. Leave blank to use default price.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {tierPrices.map((tp, index) => (
                        <div key={tp.tier_id} className="space-y-1">
                          <Label className="text-xs">{tp.tier_name}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={tp.price_xcg ?? ''}
                            onChange={(e) => {
                              const newPrices = [...tierPrices];
                              newPrices[index] = {
                                ...tp,
                                price_xcg: e.target.value ? parseFloat(e.target.value) : null,
                              };
                              setTierPrices(newPrices);
                            }}
                            placeholder={`Default: ${formData.price_xcg.toFixed(2)}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weight-based toggle */}
                <div className="p-3 border rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="is_weight_based" className="text-sm font-medium">
                        Weight-Based Item
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Allow decimal input and over-picking for this product
                      </p>
                    </div>
                    <Switch
                      id="is_weight_based"
                      checked={formData.is_weight_based}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_weight_based: checked })
                      }
                    />
                  </div>
                  
                  {formData.is_weight_based && (
                    <div className="space-y-2">
                      <Label htmlFor="weight_unit">Weight Unit</Label>
                      <Select
                        value={formData.weight_unit}
                        onValueChange={(value) => setFormData({ ...formData, weight_unit: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">Kilograms (kg)</SelectItem>
                          <SelectItem value="lb">Pounds (lb)</SelectItem>
                          <SelectItem value="g">Grams (g)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                </form>
              </ScrollArea>
              <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" form="product-form">
                  {editingProduct ? 'Update' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading products...</p>
            ) : filteredProducts && filteredProducts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price (XCG)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono">{product.code}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.name_pap && (
                            <p className="text-xs text-muted-foreground">
                              PAP: {product.name_pap}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.unit}</TableCell>
                      <TableCell>
                        {product.is_weight_based ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Weight ({product.weight_unit || 'kg'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Fixed Qty
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{product.price_xcg.toFixed(2)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            product.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Delete this product?')) {
                                deleteMutation.mutate(product.id);
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
                No products found. Add your first F&B product to get started.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}