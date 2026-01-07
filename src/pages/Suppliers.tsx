import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { useActivityLogger } from '../hooks/useActivityLogger';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { PlusCircle, Pencil, Trash2, ArrowLeft, Search, Package, Calendar, History } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { format } from 'date-fns';
import { toast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ProductPriceHistory } from '../components/ProductPriceHistory';
import { ProductFormDialog } from '../components/ProductFormDialog';
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

const Suppliers = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const { logActivity } = useActivityLogger();
  const canManage = hasRole('admin') || hasRole('management');
  
  const [currencyRate, setCurrencyRate] = useState(1.82);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<Omit<Supplier, 'id'> & { 
    cases_per_pallet?: number | null;
    pallet_stacking_pattern?: string;
    notes_pallet_config?: string;
  }>({
    name: '',
    contact: '',
    email: '',
    phone: '',
    cases_per_pallet: null,
    pallet_stacking_pattern: '',
    notes_pallet_config: '',
  });
  
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<{ id: string; code: string } | null>(null);
  const [productFormData, setProductFormData] = useState({
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

  const { data: supplierProducts } = useQuery({
    queryKey: ['supplier-products', viewingSupplier?.id],
    queryFn: async () => {
      if (!viewingSupplier) return [];
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('supplier_id', viewingSupplier.id)
        .order('code');
      if (error) throw error;
      return data as Product[];
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

  const createProductMutation = useMutation({
    mutationFn: async (values: typeof productFormData) => {
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
        supplier_id: viewingSupplier?.id || null,
        case_size: values.case_size || null,
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
      const { data, error } = await supabase
        .from('products')
        .insert([{
          code: validated.code,
          name: validated.name,
          pack_size: validated.pack_size,
          supplier_id: viewingSupplier?.id || null,
          case_size: validated.case_size,
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
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      logActivity('create_product', 'product', data.id, { name: data.name, supplier_id: viewingSupplier?.id });
      queryClient.invalidateQueries({ queryKey: ['supplier-products', viewingSupplier?.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product added successfully' });
      setIsProductDialogOpen(false);
      setProductFormData({ 
        code: '', name: '', pack_size: '', supplier_id: viewingSupplier?.id || '', case_size: '', consolidation_group: '',
        netto_weight_per_unit: '', gross_weight_per_unit: '', empty_case_weight: '',
        price_usd_per_unit: '', price_usd_per_case: '', price_xcg_per_unit: '', price_xcg_per_case: '',
        wholesale_price_usd_per_unit: '', wholesale_price_xcg_per_unit: '',
        retail_price_usd_per_unit: '', retail_price_xcg_per_unit: '',
        unit: '', length_cm: '', width_cm: '', height_cm: ''
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error adding product', description: error.message, variant: 'destructive' });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, ...values }: Product & { id: string }) => {
      const lengthCm = values.length_cm !== undefined && values.length_cm !== null ? parseFloat(values.length_cm.toString()) : null;
      const widthCm = values.width_cm !== undefined && values.width_cm !== null ? parseFloat(values.width_cm.toString()) : null;
      const heightCm = values.height_cm !== undefined && values.height_cm !== null ? parseFloat(values.height_cm.toString()) : null;

      const parsed = {
        code: values.code,
        name: values.name,
        pack_size: values.pack_size,
        case_size: values.case_size,
        netto_weight_per_unit: values.netto_weight_per_unit,
        gross_weight_per_unit: values.gross_weight_per_unit,
        empty_case_weight: values.empty_case_weight,
        price_usd_per_unit: values.price_usd_per_unit,
        price_xcg_per_unit: values.price_xcg_per_unit,
        wholesale_price_usd_per_unit: values.wholesale_price_usd_per_unit,
        wholesale_price_xcg_per_unit: values.wholesale_price_xcg_per_unit,
        retail_price_usd_per_unit: values.retail_price_usd_per_unit,
        retail_price_xcg_per_unit: values.retail_price_xcg_per_unit,
        unit: values.unit,
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
          case_size: validated.case_size,
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
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      logActivity('update_product', 'product', variables.id);
      queryClient.invalidateQueries({ queryKey: ['supplier-products', viewingSupplier?.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product updated successfully' });
      setIsProductDialogOpen(false);
      setEditingProduct(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating product', description: error.message, variant: 'destructive' });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      logActivity('delete_product', 'product', id);
      queryClient.invalidateQueries({ queryKey: ['supplier-products', viewingSupplier?.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting product', description: error.message, variant: 'destructive' });
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
        cases_per_pallet: (supplier as any).cases_per_pallet || null,
        pallet_stacking_pattern: (supplier as any).pallet_stacking_pattern || '',
        notes_pallet_config: (supplier as any).notes_pallet_config || '',
      });
    } else {
      setEditingSupplier(null);
      setFormData({ 
        name: '', 
        contact: '', 
        email: '', 
        phone: '',
        cases_per_pallet: null,
        pallet_stacking_pattern: '',
        notes_pallet_config: '',
      });
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

  const handleOpenProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      const packSize = product.pack_size || 1;
      setProductFormData({
        code: product.code,
        name: product.name,
        pack_size: product.pack_size.toString(),
        supplier_id: viewingSupplier?.id || '',
        case_size: product.case_size || '',
        consolidation_group: product.consolidation_group || '',
        netto_weight_per_unit: product.netto_weight_per_unit?.toString() || '',
        gross_weight_per_unit: product.gross_weight_per_unit?.toString() || '',
        empty_case_weight: product.empty_case_weight?.toString() || '',
        price_usd_per_unit: product.price_usd_per_unit?.toString() || '',
        price_usd_per_case: product.price_usd_per_unit ? (product.price_usd_per_unit * packSize).toFixed(2) : '',
        price_xcg_per_unit: product.price_xcg_per_unit?.toString() || '',
        price_xcg_per_case: product.price_xcg_per_unit ? (product.price_xcg_per_unit * packSize).toFixed(2) : '',
        wholesale_price_usd_per_unit: product.wholesale_price_usd_per_unit?.toString() || '',
        wholesale_price_xcg_per_unit: product.wholesale_price_xcg_per_unit?.toString() || '',
        retail_price_usd_per_unit: product.retail_price_usd_per_unit?.toString() || '',
        retail_price_xcg_per_unit: product.retail_price_xcg_per_unit?.toString() || '',
        unit: product.unit || '',
        length_cm: product.length_cm?.toString() || '',
        width_cm: product.width_cm?.toString() || '',
        height_cm: product.height_cm?.toString() || '',
      });
    } else {
      setEditingProduct(null);
      setProductFormData({ 
        code: '', name: '', pack_size: '', supplier_id: viewingSupplier?.id || '', case_size: '', consolidation_group: '',
        netto_weight_per_unit: '', gross_weight_per_unit: '', empty_case_weight: '',
        price_usd_per_unit: '', price_usd_per_case: '', price_xcg_per_unit: '', price_xcg_per_case: '',
        wholesale_price_usd_per_unit: '', wholesale_price_xcg_per_unit: '',
        retail_price_usd_per_unit: '', retail_price_xcg_per_unit: '',
        unit: '', length_cm: '', width_cm: '', height_cm: ''
      });
    }
    setIsProductDialogOpen(true);
  };

  const handleSaveProduct = () => {
    try {
      if (editingProduct) {
        updateProductMutation.mutate({ 
          id: editingProduct.id, 
          code: productFormData.code,
          name: productFormData.name,
          pack_size: parseInt(productFormData.pack_size),
          case_size: productFormData.case_size || null,
          netto_weight_per_unit: productFormData.netto_weight_per_unit ? parseFloat(productFormData.netto_weight_per_unit) : null,
          gross_weight_per_unit: productFormData.gross_weight_per_unit ? parseFloat(productFormData.gross_weight_per_unit) : null,
          empty_case_weight: productFormData.empty_case_weight ? parseFloat(productFormData.empty_case_weight) : null,
          price_usd_per_unit: productFormData.price_usd_per_unit ? parseFloat(productFormData.price_usd_per_unit) : null,
          price_xcg_per_unit: productFormData.price_xcg_per_unit ? parseFloat(productFormData.price_xcg_per_unit) : null,
          wholesale_price_usd_per_unit: productFormData.wholesale_price_usd_per_unit ? parseFloat(productFormData.wholesale_price_usd_per_unit) : null,
          wholesale_price_xcg_per_unit: productFormData.wholesale_price_xcg_per_unit ? parseFloat(productFormData.wholesale_price_xcg_per_unit) : null,
          retail_price_usd_per_unit: productFormData.retail_price_usd_per_unit ? parseFloat(productFormData.retail_price_usd_per_unit) : null,
          retail_price_xcg_per_unit: productFormData.retail_price_xcg_per_unit ? parseFloat(productFormData.retail_price_xcg_per_unit) : null,
          unit: productFormData.unit || null,
          length_cm: productFormData.length_cm ? parseFloat(productFormData.length_cm) : null,
          width_cm: productFormData.width_cm ? parseFloat(productFormData.width_cm) : null,
          height_cm: productFormData.height_cm ? parseFloat(productFormData.height_cm) : null,
        });
      } else {
        createProductMutation.mutate(productFormData);
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
                  
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-semibold mb-3">Pallet Configuration (Optional)</h4>
                    
                    <div className="space-y-2">
                      <Label htmlFor="cases_per_pallet">Cases Per Pallet</Label>
                      <Input
                        id="cases_per_pallet"
                        type="number"
                        value={formData.cases_per_pallet || ''}
                        onChange={(e) => setFormData({ ...formData, cases_per_pallet: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="e.g., 24 for Hortifresco, 80 for Steffanis"
                      />
                      <p className="text-xs text-muted-foreground">
                        If specified, this overrides automatic calculation
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pallet_stacking_pattern">Stacking Pattern</Label>
                      <Input
                        id="pallet_stacking_pattern"
                        value={formData.pallet_stacking_pattern || ''}
                        onChange={(e) => setFormData({ ...formData, pallet_stacking_pattern: e.target.value })}
                        placeholder="e.g., 4x6 grid, 2 layers"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes_pallet_config">Pallet Notes</Label>
                      <Input
                        id="notes_pallet_config"
                        value={formData.notes_pallet_config || ''}
                        onChange={(e) => setFormData({ ...formData, notes_pallet_config: e.target.value })}
                        placeholder="Any special pallet handling instructions"
                      />
                    </div>
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

        <ProductFormDialog
          isOpen={isProductDialogOpen}
          onOpenChange={setIsProductDialogOpen}
          editingProduct={editingProduct}
          formData={productFormData}
          setFormData={setProductFormData}
          suppliers={suppliers || []}
          currencyRate={currencyRate}
          setCurrencyRate={setCurrencyRate}
          onSave={handleSaveProduct}
          canManage={canManage}
        />

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
                  <TabsTrigger value="products">Products</TabsTrigger>
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

                <TabsContent value="products">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Products from this Supplier</h3>
                    {canManage && (
                      <Button onClick={() => handleOpenProductDialog()}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Product
                      </Button>
                    )}
                  </div>
                  
                  {supplierProducts && supplierProducts.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Unit Size</TableHead>
                        <TableHead>Units per Case</TableHead>
                        <TableHead>Price USD</TableHead>
                        <TableHead>Price XCG</TableHead>
                        {canManage && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                        <TableBody>
                          {supplierProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.code}</TableCell>
                          <TableCell>{product.name}</TableCell>
                          <TableCell>
                            {product.netto_weight_per_unit ? `${product.netto_weight_per_unit} ${product.unit || 'gr'}` : '-'}
                          </TableCell>
                          <TableCell>{product.pack_size}</TableCell>
                          <TableCell>
                            {product.price_usd_per_unit ? (
                              <div>
                                <div>${product.price_usd_per_unit.toFixed(2)}/unit</div>
                                <div className="text-xs text-muted-foreground">
                                  ${(product.price_usd_per_unit * product.pack_size).toFixed(2)}/case
                                </div>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {product.price_xcg_per_unit ? (
                              <div>
                                <div>{product.price_xcg_per_unit.toFixed(2)}/unit</div>
                                <div className="text-xs text-muted-foreground">
                                  {(product.price_xcg_per_unit * product.pack_size).toFixed(2)}/case
                                </div>
                              </div>
                            ) : '-'}
                          </TableCell>
                              {canManage && (
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setPriceHistoryProduct({ id: product.id, code: product.code })}
                                    >
                                      <History className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenProductDialog(product)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        if (confirm('Are you sure you want to delete this product?')) {
                                          deleteProductMutation.mutate(product.id);
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
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No products found for this supplier.</p>
                      {canManage && (
                        <Button className="mt-4" onClick={() => handleOpenProductDialog()}>
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Add First Product
                        </Button>
                      )}
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
        
        {priceHistoryProduct && (
          <ProductPriceHistory
            productId={priceHistoryProduct.id}
            productCode={priceHistoryProduct.code}
            open={!!priceHistoryProduct}
            onOpenChange={(open) => !open && setPriceHistoryProduct(null)}
          />
        )}
      </main>
    </div>
  );
};

export default Suppliers;
