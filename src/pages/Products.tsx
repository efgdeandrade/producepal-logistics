import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useActivityLogger } from '@/hooks/useActivityLogger';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Pencil, Trash2, ArrowLeft, Search, History, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ProductPriceHistory } from '@/components/ProductPriceHistory';
import { ProductFormDialog } from '@/components/ProductFormDialog';
import { SupplierPriceEntry } from '@/components/SupplierPricingSection';

const productSchema = z.object({
  code: z.string().trim().min(1, 'Product code is required').max(50, 'Code too long'),
  name: z.string().trim().min(1, 'Product name is required').max(200, 'Name too long'),
  pack_size: z.number().int().min(1, 'Units per case must be at least 1'),
  supplier_id: z.string().uuid().optional().nullable(),
  case_size: z.string().trim().max(50, 'Case size too long').optional().nullable(),
  consolidation_group: z.string().trim().max(50, 'Consolidation group too long').optional().nullable(),
  netto_weight_per_unit: z.number().min(0, 'Netto weight cannot be negative').optional().nullable(),
  gross_weight_per_unit: z.number().min(0, 'Gross weight cannot be negative').optional().nullable(),
  empty_case_weight: z.number().min(0, 'Empty case weight cannot be negative').optional().nullable(),
  price_usd_per_unit: z.number().min(0, 'Price cannot be negative').optional().nullable(),
  price_xcg_per_unit: z.number().min(0, 'Price cannot be negative').optional().nullable(),
  wholesale_price_usd_per_unit: z.number().min(0, 'Wholesale price cannot be negative').optional().nullable(),
  wholesale_price_xcg_per_unit: z.number().min(0, 'Wholesale price cannot be negative').optional().nullable(),
  retail_price_usd_per_unit: z.number().min(0, 'Retail price cannot be negative').optional().nullable(),
  retail_price_xcg_per_unit: z.number().min(0, 'Retail price cannot be negative').optional().nullable(),
  unit: z.string().trim().max(20, 'Unit too long').optional().nullable(),
  length_cm: z.number().min(0, 'Length cannot be negative').optional().nullable(),
  width_cm: z.number().min(0, 'Width cannot be negative').optional().nullable(),
  height_cm: z.number().min(0, 'Height cannot be negative').optional().nullable(),
});

interface Product {
  id: string;
  code: string;
  name: string;
  pack_size: number;
  supplier_id?: string | null;
  case_size?: string | null;
  consolidation_group?: string | null;
  netto_weight_per_unit?: number | null;
  gross_weight_per_unit?: number | null;
  empty_case_weight?: number | null;
  price_usd_per_unit?: number | null;
  price_xcg_per_unit?: number | null;
  wholesale_price_usd_per_unit?: number | null;
  wholesale_price_xcg_per_unit?: number | null;
  retail_price_usd_per_unit?: number | null;
  retail_price_xcg_per_unit?: number | null;
  unit?: string | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  volumetric_weight_kg?: number | null;
}


const Products = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const { logActivity } = useActivityLogger();
  const canManage = canCreate('data') || canUpdate('data');
  
  const [currencyRate, setCurrencyRate] = useState(1.82);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<{ id: string; code: string } | null>(null);
  const [supplierPrices, setSupplierPrices] = useState<SupplierPriceEntry[]>([]);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    pack_size: '',
    supplier_id: '',
    case_size: '',
    consolidation_group: '',
    netto_weight_per_unit: '',
    gross_weight_per_unit: '',
    empty_case_weight: '',
    price_usd_per_unit: '',
    price_usd_per_case: '',
    price_xcg_per_unit: '',
    price_xcg_per_case: '',
    wholesale_price_usd_per_unit: '',
    wholesale_price_xcg_per_unit: '',
    retail_price_usd_per_unit: '',
    retail_price_xcg_per_unit: '',
    unit: '',
    length_cm: '',
    width_cm: '',
    height_cm: '',
  });

  // Generate product code for new products
  const generateProductCode = async (): Promise<string> => {
    const { data } = await supabase
      .from('products')
      .select('code')
      .order('code', { ascending: false })
      .limit(200);
    
    let maxNum = 0;
    data?.forEach(p => {
      // Match IMP-XXXXXX format
      const impMatch = p.code.match(/^IMP-(\d+)$/);
      // Match pure numeric codes
      const numMatch = p.code.match(/^(\d+)/);
      if (impMatch) {
        maxNum = Math.max(maxNum, parseInt(impMatch[1]));
      } else if (numMatch) {
        maxNum = Math.max(maxNum, parseInt(numMatch[1]));
      }
    });
    
    return `IMP-${String(maxNum + 1).padStart(6, '0')}`;
  };

  const handleOpenDialog = async (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        code: product.code,
        name: product.name,
        pack_size: product.pack_size.toString(),
        supplier_id: product.supplier_id || '',
        case_size: product.case_size || '',
        consolidation_group: product.consolidation_group || '',
        netto_weight_per_unit: product.netto_weight_per_unit?.toString() || '',
        gross_weight_per_unit: product.gross_weight_per_unit?.toString() || '',
        empty_case_weight: product.empty_case_weight?.toString() || '',
        price_usd_per_unit: product.price_usd_per_unit?.toString() || '',
        price_usd_per_case: '',
        price_xcg_per_unit: product.price_xcg_per_unit?.toString() || '',
        price_xcg_per_case: '',
        wholesale_price_usd_per_unit: product.wholesale_price_usd_per_unit?.toString() || '',
        wholesale_price_xcg_per_unit: product.wholesale_price_xcg_per_unit?.toString() || '',
        retail_price_usd_per_unit: product.retail_price_usd_per_unit?.toString() || '',
        retail_price_xcg_per_unit: product.retail_price_xcg_per_unit?.toString() || '',
        unit: product.unit || '',
        length_cm: product.length_cm?.toString() || '',
        width_cm: product.width_cm?.toString() || '',
        height_cm: product.height_cm?.toString() || '',
      });
      
      // Fetch existing supplier prices for this product
      const { data: existingPrices, error } = await supabase
        .from('product_supplier_prices')
        .select('*')
        .eq('product_id', product.id);
      
      if (!error && existingPrices) {
        setSupplierPrices(existingPrices.map(sp => ({
          id: sp.id,
          supplier_id: sp.supplier_id,
          cost_price_usd: sp.cost_price_usd?.toString() || '',
          cost_price_xcg: sp.cost_price_xcg?.toString() || '',
          lead_time_days: sp.lead_time_days?.toString() || '',
          min_order_qty: sp.min_order_qty?.toString() || '',
          notes: sp.notes || '',
        })));
      } else {
        setSupplierPrices([]);
      }
    } else {
      setEditingProduct(null);
      setSupplierPrices([]);
      
      // Generate product code for new products
      const generatedCode = await generateProductCode();
      
      setFormData({
        code: generatedCode,
        name: '',
        pack_size: '',
        supplier_id: '',
        case_size: '',
        consolidation_group: '',
        netto_weight_per_unit: '',
        gross_weight_per_unit: '',
        empty_case_weight: '',
        price_usd_per_unit: '',
        price_usd_per_case: '',
        price_xcg_per_unit: '',
        price_xcg_per_case: '',
        wholesale_price_usd_per_unit: '',
        wholesale_price_xcg_per_unit: '',
        retail_price_usd_per_unit: '',
        retail_price_xcg_per_unit: '',
        unit: '',
        length_cm: '',
        width_cm: '',
        height_cm: '',
      });
    }
    setIsDialogOpen(true);
  };

  // Duplicate a product - copies all data with new code, opens dialog for editing
  const handleDuplicateProduct = async (product: Product) => {
    const generatedCode = await generateProductCode();
    
    setEditingProduct(null); // This will be a new product
    setFormData({
      code: generatedCode,
      name: `${product.name} (Copy)`,
      pack_size: product.pack_size.toString(),
      supplier_id: product.supplier_id || '',
      case_size: product.case_size || '',
      consolidation_group: product.consolidation_group || '',
      netto_weight_per_unit: product.netto_weight_per_unit?.toString() || '',
      gross_weight_per_unit: product.gross_weight_per_unit?.toString() || '',
      empty_case_weight: product.empty_case_weight?.toString() || '',
      price_usd_per_unit: product.price_usd_per_unit?.toString() || '',
      price_usd_per_case: '',
      price_xcg_per_unit: product.price_xcg_per_unit?.toString() || '',
      price_xcg_per_case: '',
      wholesale_price_usd_per_unit: product.wholesale_price_usd_per_unit?.toString() || '',
      wholesale_price_xcg_per_unit: product.wholesale_price_xcg_per_unit?.toString() || '',
      retail_price_usd_per_unit: product.retail_price_usd_per_unit?.toString() || '',
      retail_price_xcg_per_unit: product.retail_price_xcg_per_unit?.toString() || '',
      unit: product.unit || '',
      length_cm: product.length_cm?.toString() || '',
      width_cm: product.width_cm?.toString() || '',
      height_cm: product.height_cm?.toString() || '',
    });
    
    // Copy supplier prices from original product
    const { data: existingPrices, error } = await supabase
      .from('product_supplier_prices')
      .select('*')
      .eq('product_id', product.id);
    
    if (!error && existingPrices) {
      setSupplierPrices(existingPrices.map(sp => ({
        id: undefined, // New entries, no ID yet
        supplier_id: sp.supplier_id,
        cost_price_usd: sp.cost_price_usd?.toString() || '',
        cost_price_xcg: sp.cost_price_xcg?.toString() || '',
        lead_time_days: sp.lead_time_days?.toString() || '',
        min_order_qty: sp.min_order_qty?.toString() || '',
        notes: sp.notes || '',
      })));
    } else {
      setSupplierPrices([]);
    }
    
    setIsDialogOpen(true);
    toast({ title: 'Product duplicated', description: 'Edit the details and save as a new product.' });
  };


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
      const lengthCm = values.length_cm ? parseFloat(values.length_cm) : null;
      const widthCm = values.width_cm ? parseFloat(values.width_cm) : null;
      const heightCm = values.height_cm ? parseFloat(values.height_cm) : null;
      const volumetricWeightKg = lengthCm && widthCm && heightCm
        ? (lengthCm * widthCm * heightCm) / 6000
        : null;

      const parsed = {
        code: values.code,
        name: values.name,
        pack_size: parseInt(values.pack_size),
        supplier_id: values.supplier_id || null,
        case_size: values.case_size || null,
        consolidation_group: values.consolidation_group || null,
        netto_weight_per_unit: values.netto_weight_per_unit ? parseFloat(values.netto_weight_per_unit) : null,
        gross_weight_per_unit: values.gross_weight_per_unit ? parseFloat(values.gross_weight_per_unit) : null,
        empty_case_weight: values.empty_case_weight ? parseFloat(values.empty_case_weight) : null,
        price_usd_per_unit: values.price_usd_per_unit ? parseFloat(values.price_usd_per_unit) : null,
        price_xcg_per_unit: values.price_xcg_per_unit ? parseFloat(values.price_xcg_per_unit) : null,
        wholesale_price_usd_per_unit: values.wholesale_price_usd_per_unit ? parseFloat(values.wholesale_price_usd_per_unit) : null,
        wholesale_price_xcg_per_unit: values.wholesale_price_xcg_per_unit ? parseFloat(values.wholesale_price_xcg_per_unit) : null,
        retail_price_usd_per_unit: values.retail_price_usd_per_unit ? parseFloat(values.retail_price_usd_per_unit) : null,
        retail_price_xcg_per_unit: values.retail_price_xcg_per_unit ? parseFloat(values.retail_price_xcg_per_unit) : null,
        unit: values.unit || null,
        length_cm: lengthCm,
        width_cm: widthCm,
        height_cm: heightCm,
      };
      
      const validated = productSchema.parse(parsed);
      
      const { data, error } = await supabase.from('products').insert([{
        code: validated.code,
        name: validated.name,
        pack_size: validated.pack_size,
        supplier_id: validated.supplier_id,
        case_size: validated.case_size,
        consolidation_group: validated.consolidation_group,
        netto_weight_per_unit: validated.netto_weight_per_unit,
        gross_weight_per_unit: validated.gross_weight_per_unit,
        empty_case_weight: validated.empty_case_weight,
        price_usd_per_unit: validated.price_usd_per_unit,
        price_xcg_per_unit: validated.price_xcg_per_unit,
        wholesale_price_usd_per_unit: validated.wholesale_price_usd_per_unit,
        wholesale_price_xcg_per_unit: validated.wholesale_price_xcg_per_unit,
        retail_price_usd_per_unit: validated.retail_price_usd_per_unit,
        retail_price_xcg_per_unit: validated.retail_price_xcg_per_unit,
        unit: validated.unit,
        length_cm: validated.length_cm,
        width_cm: validated.width_cm,
        height_cm: validated.height_cm,
        volumetric_weight_kg: volumetricWeightKg,
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
        code: '', name: '', pack_size: '', supplier_id: '', case_size: '', consolidation_group: '',
        netto_weight_per_unit: '', gross_weight_per_unit: '', empty_case_weight: '',
        price_usd_per_unit: '', price_usd_per_case: '', price_xcg_per_unit: '', price_xcg_per_case: '',
        wholesale_price_usd_per_unit: '', wholesale_price_xcg_per_unit: '',
        retail_price_usd_per_unit: '', retail_price_xcg_per_unit: '', unit: '',
        length_cm: '', width_cm: '', height_cm: ''
      });
    },
    onError: (error: Error) => {
      console.error('Full error:', error);
      toast({ title: 'Error adding product', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & typeof formData) => {
      const lengthCm = values.length_cm ? parseFloat(values.length_cm) : null;
      const widthCm = values.width_cm ? parseFloat(values.width_cm) : null;
      const heightCm = values.height_cm ? parseFloat(values.height_cm) : null;
      const volumetricWeightKg = lengthCm && widthCm && heightCm
        ? (lengthCm * widthCm * heightCm) / 6000
        : null;

      const parsed = {
        code: values.code,
        name: values.name,
        pack_size: parseInt(values.pack_size),
        supplier_id: values.supplier_id || null,
        case_size: values.case_size || null,
        consolidation_group: values.consolidation_group || null,
        netto_weight_per_unit: values.netto_weight_per_unit ? parseFloat(values.netto_weight_per_unit) : null,
        gross_weight_per_unit: values.gross_weight_per_unit ? parseFloat(values.gross_weight_per_unit) : null,
        empty_case_weight: values.empty_case_weight ? parseFloat(values.empty_case_weight) : null,
        price_usd_per_unit: values.price_usd_per_unit ? parseFloat(values.price_usd_per_unit) : null,
        price_xcg_per_unit: values.price_xcg_per_unit ? parseFloat(values.price_xcg_per_unit) : null,
        wholesale_price_usd_per_unit: values.wholesale_price_usd_per_unit ? parseFloat(values.wholesale_price_usd_per_unit) : null,
        wholesale_price_xcg_per_unit: values.wholesale_price_xcg_per_unit ? parseFloat(values.wholesale_price_xcg_per_unit) : null,
        retail_price_usd_per_unit: values.retail_price_usd_per_unit ? parseFloat(values.retail_price_usd_per_unit) : null,
        retail_price_xcg_per_unit: values.retail_price_xcg_per_unit ? parseFloat(values.retail_price_xcg_per_unit) : null,
        unit: values.unit || null,
        length_cm: lengthCm,
        width_cm: widthCm,
        height_cm: heightCm,
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
          consolidation_group: validated.consolidation_group,
          netto_weight_per_unit: validated.netto_weight_per_unit,
          gross_weight_per_unit: validated.gross_weight_per_unit,
          empty_case_weight: validated.empty_case_weight,
          price_usd_per_unit: validated.price_usd_per_unit,
          price_xcg_per_unit: validated.price_xcg_per_unit,
          wholesale_price_usd_per_unit: validated.wholesale_price_usd_per_unit,
          wholesale_price_xcg_per_unit: validated.wholesale_price_xcg_per_unit,
          retail_price_usd_per_unit: validated.retail_price_usd_per_unit,
          retail_price_xcg_per_unit: validated.retail_price_xcg_per_unit,
          unit: validated.unit,
          length_cm: validated.length_cm,
          width_cm: validated.width_cm,
          height_cm: validated.height_cm,
          volumetric_weight_kg: volumetricWeightKg,
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



  const handleSave = async () => {
    try {
      if (editingProduct) {
        await updateMutation.mutateAsync({ id: editingProduct.id, ...formData });
        // Save supplier prices
        await saveSupplierPrices(editingProduct.id);
      } else {
        const newProduct = await createMutation.mutateAsync(formData);
        // Save supplier prices for new product
        if (newProduct) {
          await saveSupplierPrices(newProduct.id);
        }
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

  const saveSupplierPrices = async (productId: string) => {
    // Delete existing supplier prices for this product
    await supabase
      .from('product_supplier_prices')
      .delete()
      .eq('product_id', productId);

    // Insert new supplier prices
    const validPrices = supplierPrices.filter(sp => sp.supplier_id);
    if (validPrices.length > 0) {
      const pricesToInsert = validPrices.map(sp => ({
        product_id: productId,
        supplier_id: sp.supplier_id,
        cost_price_usd: sp.cost_price_usd ? parseFloat(sp.cost_price_usd) : 0,
        cost_price_xcg: sp.cost_price_xcg ? parseFloat(sp.cost_price_xcg) : 0,
        lead_time_days: sp.lead_time_days ? parseInt(sp.lead_time_days) : null,
        min_order_qty: sp.min_order_qty ? parseInt(sp.min_order_qty) : null,
        notes: sp.notes || null,
      }));

      const { error } = await supabase
        .from('product_supplier_prices')
        .insert(pricesToInsert);

      if (error) {
        console.error('Error saving supplier prices:', error);
        toast({ 
          title: 'Warning', 
          description: 'Product saved but supplier prices may not have been saved correctly.', 
          variant: 'destructive' 
        });
      }
    }
    
    // Reset supplier prices state
    setSupplierPrices([]);
  };

  if (productsLoading) {
    return (
      <div className="container py-6">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="container py-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="mr-4">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground mb-2">Products</h1>
            <p className="text-muted-foreground">Manage your product catalog, pricing, and supplier information</p>
          </div>
          {canManage && (
            <div className="ml-auto flex gap-2">
              <Button onClick={() => handleOpenDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>
          )}
        </div>

        <ProductFormDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          editingProduct={editingProduct}
          formData={formData}
          setFormData={setFormData}
          suppliers={suppliers || []}
          currencyRate={currencyRate}
          setCurrencyRate={setCurrencyRate}
          onSave={handleSave}
          canManage={canManage}
          supplierPrices={supplierPrices}
          onSupplierPricesChange={setSupplierPrices}
        />

        <div className="flex items-center mb-6">
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
                        <span className="font-medium">Cost Price USD:</span> ${product.price_usd_per_unit.toFixed(2)}/unit
                      </p>
                      <p className="text-muted-foreground text-sm">
                        <span className="font-medium">Cost per case:</span> ${(product.price_usd_per_unit * product.pack_size).toFixed(2)}
                      </p>
                    </>
                  )}
                  {product.price_xcg_per_unit && (
                    <>
                      <p className="text-muted-foreground">
                        <span className="font-medium">Cost Price Cg:</span> Cg {product.price_xcg_per_unit.toFixed(2)}/unit
                      </p>
                      <p className="text-muted-foreground text-sm">
                        <span className="font-medium">Cost per case:</span> Cg {(product.price_xcg_per_unit * product.pack_size).toFixed(2)}
                      </p>
                    </>
                  )}
                  {product.wholesale_price_usd_per_unit && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Wholesale USD:</span> ${product.wholesale_price_usd_per_unit.toFixed(2)}/unit
                    </p>
                  )}
                  {product.wholesale_price_xcg_per_unit && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Wholesale Cg:</span> Cg {product.wholesale_price_xcg_per_unit.toFixed(2)}/unit
                    </p>
                  )}
                  {product.retail_price_usd_per_unit && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Retail USD:</span> ${product.retail_price_usd_per_unit.toFixed(2)}/unit
                    </p>
                  )}
                  {product.retail_price_xcg_per_unit && (
                    <p className="text-muted-foreground">
                      <span className="font-medium">Retail Cg:</span> Cg {product.retail_price_xcg_per_unit.toFixed(2)}/unit
                    </p>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPriceHistoryProduct({ id: product.id, code: product.code })}
                  >
                    <History className="h-4 w-4 mr-1" />
                    History
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicateProduct(product)}
                        title="Duplicate this product"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Duplicate
                      </Button>
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
        
        {priceHistoryProduct && (
          <ProductPriceHistory
            productId={priceHistoryProduct.id}
            productCode={priceHistoryProduct.code}
            open={!!priceHistoryProduct}
            onOpenChange={(open) => !open && setPriceHistoryProduct(null)}
        />
      )}
    </div>
  );
};

export default Products;
