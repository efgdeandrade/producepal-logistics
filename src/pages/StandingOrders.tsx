import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Save, Wand2, X } from 'lucide-react';
import { useStandingOrders } from '@/hooks/useStandingOrders';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Product {
  id: string;
  code: string;
  name: string;
  pack_size: number;
  supplier_id: string | null;
  consolidation_group: string | null;
}

interface Customer {
  id: string;
  name: string;
}

interface TemplateProduct {
  id: string;
  productCode: string;
  productName: string;
  trays: number;
  units: number;
  packSize: number;
}

interface TemplateCustomer {
  id: string;
  customerId: string;
  customerName: string;
  products: TemplateProduct[];
}

// Days we typically have orders (Tuesday, Wednesday, Friday)
const ACTIVE_DAYS = [2, 3, 5];

export default function StandingOrders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    templates, 
    loading, 
    createOrUpdateTemplate, 
    deleteTemplate,
    generateTemplateFromLastOrder,
    DAY_NAMES 
  } = useStandingOrders();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(2); // Tuesday by default
  const [editingTemplate, setEditingTemplate] = useState<TemplateCustomer[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Load template data when day changes
    const template = templates.find(t => t.day_of_week === selectedDay);
    if (template) {
      setTemplateName(template.name);
      loadTemplateIntoEditor(template);
    } else {
      setTemplateName(`${DAY_NAMES[selectedDay]} Orders`);
      setEditingTemplate([]);
    }
  }, [selectedDay, templates]);

  const loadData = async () => {
    const [customersRes, productsRes, suppliersRes] = await Promise.all([
      supabase.from('customers').select('id, name').order('name'),
      supabase.from('products').select('id, code, name, pack_size, supplier_id, consolidation_group').order('name'),
      supabase.from('suppliers').select('id, name').order('name'),
    ]);

    if (customersRes.data) setCustomers(customersRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    if (suppliersRes.data) setSuppliers(suppliersRes.data);
  };

  const loadTemplateIntoEditor = (template: any) => {
    if (!template.items || template.items.length === 0) {
      setEditingTemplate([]);
      return;
    }

    // Group items by customer
    const customerMap = new Map<string, TemplateCustomer>();
    
    template.items.forEach((item: any) => {
      const product = products.find(p => p.code === item.product_code);
      const packSize = product?.pack_size || 1;
      const trays = item.default_quantity;
      const units = trays * packSize;
      
      const existing = customerMap.get(item.customer_id);
      if (existing) {
        existing.products.push({
          id: Date.now().toString() + Math.random(),
          productCode: item.product_code,
          productName: product?.name || item.product_code,
          trays,
          units,
          packSize,
        });
      } else {
        customerMap.set(item.customer_id, {
          id: Date.now().toString() + Math.random(),
          customerId: item.customer_id,
          customerName: item.customer_name,
          products: [{
            id: Date.now().toString() + Math.random(),
            productCode: item.product_code,
            productName: product?.name || item.product_code,
            trays,
            units,
            packSize,
          }],
        });
      }
    });

    setEditingTemplate(Array.from(customerMap.values()));
  };

  const addCustomer = () => {
    setEditingTemplate([
      ...editingTemplate,
      {
        id: Date.now().toString(),
        customerId: '',
        customerName: '',
        products: [],
      }
    ]);
  };

  const removeCustomer = (id: string) => {
    setEditingTemplate(editingTemplate.filter(c => c.id !== id));
  };

  const updateCustomer = (id: string, customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    setEditingTemplate(editingTemplate.map(c =>
      c.id === id ? { ...c, customerId, customerName: customer.name } : c
    ));
  };

  const addProductToCustomer = (customerId: string, productCode: string) => {
    const product = products.find(p => p.code === productCode);
    if (!product) return;

    setEditingTemplate(editingTemplate.map(c => {
      if (c.id !== customerId) return c;
      
      // Check if product already exists
      if (c.products.some(p => p.productCode === productCode)) {
        toast({ title: 'Product already added', variant: 'destructive' });
        return c;
      }

      return {
        ...c,
        products: [...c.products, {
          id: Date.now().toString(),
          productCode: product.code,
          productName: product.name,
          trays: 0,
          units: 0,
          packSize: product.pack_size || 1,
        }]
      };
    }));
  };

  const removeProduct = (customerId: string, productId: string) => {
    setEditingTemplate(editingTemplate.map(c =>
      c.id === customerId
        ? { ...c, products: c.products.filter(p => p.id !== productId) }
        : c
    ));
  };

  const updateProductTrays = (customerId: string, productId: string, trays: number) => {
    setEditingTemplate(editingTemplate.map(c =>
      c.id === customerId
        ? {
            ...c,
            products: c.products.map(p =>
              p.id === productId ? { ...p, trays, units: trays * p.packSize } : p
            )
          }
        : c
    ));
  };

  const updateProductUnits = (customerId: string, productId: string, units: number) => {
    setEditingTemplate(editingTemplate.map(c =>
      c.id === customerId
        ? {
            ...c,
            products: c.products.map(p =>
              p.id === productId ? { ...p, units, trays: Math.ceil(units / p.packSize) } : p
            )
          }
        : c
    ));
  };

  const handleSave = async () => {
    setSaving(true);

    // Convert editing format to template items format
    const items = editingTemplate.flatMap((customer, customerIndex) =>
      customer.products.map((product, productIndex) => ({
        customer_id: customer.customerId,
        customer_name: customer.customerName,
        product_code: product.productCode,
        default_quantity: product.trays,
        sort_order: customerIndex * 100 + productIndex,
      }))
    );

    await createOrUpdateTemplate(selectedDay, templateName, items);
    setSaving(false);
  };

  const handleGenerateFromLastOrder = async () => {
    setGenerating(true);
    const result = await generateTemplateFromLastOrder(selectedDay);
    
    if (result) {
      setTemplateName(result.name);
      
      // Convert to editor format
      const customerMap = new Map<string, TemplateCustomer>();
      
      result.items.forEach(item => {
        const product = products.find(p => p.code === item.product_code);
        const packSize = product?.pack_size || 1;
        const trays = item.default_quantity;
        const units = trays * packSize;
        
        const existing = customerMap.get(item.customer_id);
        if (existing) {
          existing.products.push({
            id: Date.now().toString() + Math.random(),
            productCode: item.product_code,
            productName: product?.name || item.product_code,
            trays,
            units,
            packSize,
          });
        } else {
          customerMap.set(item.customer_id, {
            id: Date.now().toString() + Math.random(),
            customerId: item.customer_id,
            customerName: item.customer_name,
            products: [{
              id: Date.now().toString() + Math.random(),
              productCode: item.product_code,
              productName: product?.name || item.product_code,
              trays,
              units,
              packSize,
            }],
          });
        }
      });

      setEditingTemplate(Array.from(customerMap.values()));
      toast({ 
        title: 'Template Generated', 
        description: `Generated from order ${result.sourceOrder}. Review and save when ready.` 
      });
    }
    
    setGenerating(false);
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;
    
    await deleteTemplate(templateToDelete);
    setEditingTemplate([]);
    setTemplateName(`${DAY_NAMES[selectedDay]} Orders`);
    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
  };

  const currentTemplate = templates.find(t => t.day_of_week === selectedDay);

  // Calculate roundup - aggregate all products across all customers
  const calculateRoundup = () => {
    const productMap = new Map<string, { product: Product; totalTrays: number; totalUnits: number }>();

    editingTemplate.forEach(customer => {
      customer.products.forEach(templateProduct => {
        const product = products.find(p => p.code === templateProduct.productCode);
        if (!product) return;

        const existing = productMap.get(product.id);
        if (existing) {
          existing.totalTrays += templateProduct.trays;
          existing.totalUnits += templateProduct.units;
        } else {
          productMap.set(product.id, {
            product,
            totalTrays: templateProduct.trays,
            totalUnits: templateProduct.units,
          });
        }
      });
    });

    return Array.from(productMap.values()).sort((a, b) => a.product.name.localeCompare(b.product.name));
  };

  interface ConsolidatedGroup {
    groupName: string | null;
    packSize: number;
    products: Array<{ product: Product; individualUnits: number }>;
    totalUnits: number;
    totalCases: number;
  }

  interface SupplierGroup {
    supplier: { id: string; name: string };
    consolidatedGroups: ConsolidatedGroup[];
  }

  const groupBySupplier = (): SupplierGroup[] => {
    const roundup = calculateRoundup();
    const supplierMap = new Map<string, SupplierGroup>();

    roundup.forEach(item => {
      const supplierId = item.product.supplier_id || 'unknown';
      const supplier = suppliers.find(s => s.id === supplierId) || { id: 'unknown', name: 'Unknown Supplier' };
      const groupKey = item.product.consolidation_group;
      const packSize = item.product.pack_size;

      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, { supplier, consolidatedGroups: [] });
      }

      const supplierGroup = supplierMap.get(supplierId)!;
      
      // Find or create consolidation group
      let consolidatedGroup = supplierGroup.consolidatedGroups.find(
        cg => cg.groupName === groupKey && cg.packSize === packSize
      );

      if (!consolidatedGroup) {
        consolidatedGroup = {
          groupName: groupKey,
          packSize,
          products: [],
          totalUnits: 0,
          totalCases: 0,
        };
        supplierGroup.consolidatedGroups.push(consolidatedGroup);
      }

      consolidatedGroup.products.push({ product: item.product, individualUnits: item.totalUnits });
      consolidatedGroup.totalUnits += item.totalUnits;
      consolidatedGroup.totalCases = Math.ceil(consolidatedGroup.totalUnits / packSize);
    });

    return Array.from(supplierMap.values());
  };

  const roundup = calculateRoundup();

  if (loading) {
    return (
      <div className="container py-8 text-center">
        <p className="text-muted-foreground">Loading standing orders...</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-4xl font-bold text-foreground">Standing Orders</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your recurring order templates for each delivery day
          </p>
        </div>

        <Tabs 
          value={selectedDay.toString()} 
          onValueChange={(v) => setSelectedDay(parseInt(v))}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            {ACTIVE_DAYS.map(day => {
              const template = templates.find(t => t.day_of_week === day);
              const itemCount = template?.items?.length || 0;
              const defaultName = `${DAY_NAMES[day]} Orders`;
              const hasCustomName = template?.name && template.name !== defaultName;
              const displayName = hasCustomName ? template.name : DAY_NAMES[day];
              
              return (
                <TabsTrigger 
                  key={day} 
                  value={day.toString()}
                  className="relative flex flex-col items-center gap-0.5 py-2"
                >
                  <span className="font-medium">{displayName}</span>
                  {hasCustomName && (
                    <span className="text-xs text-muted-foreground">{DAY_NAMES[day]}</span>
                  )}
                  {itemCount > 0 && (
                    <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 px-1.5">
                      {itemCount}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {ACTIVE_DAYS.map(day => (
            <TabsContent key={day} value={day.toString()} className="space-y-6">
              {/* Template Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle>
                        <Input
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          className="text-xl font-bold border-0 p-0 h-auto focus-visible:ring-0"
                          placeholder={`${DAY_NAMES[day]} Orders`}
                        />
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {currentTemplate 
                          ? `${editingTemplate.length} customers, ${editingTemplate.reduce((sum, c) => sum + c.products.length, 0)} items`
                          : 'No template configured yet'
                        }
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleGenerateFromLastOrder}
                        disabled={generating}
                      >
                        <Wand2 className="mr-2 h-4 w-4" />
                        {generating ? 'Generating...' : 'Generate from Last Order'}
                      </Button>
                      {currentTemplate && (
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => {
                            setTemplateToDelete(currentTemplate.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Customer Cards */}
              {editingTemplate.map((customer) => (
                <Card key={customer.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <Label>Customer</Label>
                        <Select 
                          value={customer.customerId} 
                          onValueChange={(value) => updateCustomer(customer.id, value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select customer..." />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label>Add Product</Label>
                        <Select
                          value=""
                          onValueChange={(value) => addProductToCustomer(customer.id, value)}
                          disabled={!customer.customerId}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select product to add..." />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map(p => (
                              <SelectItem key={p.id} value={p.code}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCustomer(customer.id)}
                        className="mt-6"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {customer.products.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No products added yet. Select a product from the dropdown above.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Product</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-foreground w-28">Trays/Cases</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-foreground w-28">Units</th>
                              <th className="text-center py-3 px-4 text-sm font-semibold text-foreground w-24">Pack Size</th>
                              <th className="w-12"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {customer.products.map((product) => (
                              <tr key={product.id} className="border-b">
                                <td className="py-3 px-4 text-sm text-foreground">{product.productName}</td>
                                <td className="py-3 px-4">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={product.trays || ''}
                                    onChange={(e) => updateProductTrays(
                                      customer.id, 
                                      product.id, 
                                      parseInt(e.target.value) || 0
                                    )}
                                    className="w-24 ml-auto text-right"
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={product.units || ''}
                                    onChange={(e) => updateProductUnits(
                                      customer.id, 
                                      product.id, 
                                      parseInt(e.target.value) || 0
                                    )}
                                    className="w-24 ml-auto text-right"
                                  />
                                </td>
                                <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                                  {product.packSize}
                                </td>
                                <td className="py-3 px-4">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeProduct(customer.id, product.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Add Customer Button */}
              <Button onClick={addCustomer} variant="outline" className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>

              {/* Template Roundup */}
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-primary">Template Roundup</CardTitle>
                  <CardDescription>Total quantities in this template</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Product</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Total Trays</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Total Units</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roundup.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                              No products added yet
                            </td>
                          </tr>
                        ) : (
                          roundup.map(({ product, totalTrays, totalUnits }) => (
                            <tr key={product.id} className="border-b">
                              <td className="py-3 px-4 text-sm font-medium text-foreground">
                                {product.name}
                                {product.consolidation_group && (
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                                    {product.consolidation_group.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right text-lg font-bold text-primary">{totalTrays}</td>
                              <td className="py-3 px-4 text-right text-sm text-muted-foreground">{totalUnits}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Consolidated Supplier Orders Section */}
                  {roundup.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="text-sm font-semibold text-foreground mb-4">Consolidated Supplier Orders</h4>
                      <div className="space-y-4">
                        {groupBySupplier().map((supplierGroup) => (
                          <div key={supplierGroup.supplier.id} className="border rounded-lg p-4 bg-background">
                            <h5 className="font-medium text-foreground mb-3">{supplierGroup.supplier.name}</h5>
                            <div className="space-y-2">
                              {supplierGroup.consolidatedGroups.map((cg, idx) => {
                                const isConsolidated = cg.groupName && cg.products.length > 1;
                                
                                if (isConsolidated) {
                                  return (
                                    <div key={idx} className="bg-green-50 dark:bg-green-950/20 rounded p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-green-800 dark:text-green-200">
                                          {cg.groupName?.replace(/_/g, ' ')} ({cg.packSize}/case)
                                        </span>
                                        <span className="font-bold text-green-700 dark:text-green-300">
                                          {cg.totalCases} CASE{cg.totalCases !== 1 ? 'S' : ''}
                                        </span>
                                      </div>
                                      <div className="text-sm text-muted-foreground space-y-1">
                                        {cg.products.map((p, pIdx) => (
                                          <div key={pIdx} className="flex justify-between pl-4">
                                            <span>↳ {p.product.name}</span>
                                            <span>{p.individualUnits} units</span>
                                          </div>
                                        ))}
                                        <div className="flex justify-between pl-4 pt-1 border-t border-green-200 dark:border-green-800 font-medium">
                                          <span>Total in case(s)</span>
                                          <span>{cg.totalUnits} units</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                } else {
                                  return cg.products.map((p, pIdx) => (
                                    <div key={`${idx}-${pIdx}`} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded">
                                      <span className="text-sm text-foreground">{p.product.name}</span>
                                      <div className="text-right">
                                        <span className="text-sm text-muted-foreground">{p.individualUnits} units</span>
                                        <span className="ml-3 font-bold text-foreground">{cg.totalCases} case{cg.totalCases !== 1 ? 's' : ''}</span>
                                      </div>
                                    </div>
                                  ));
                                }
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Save Button */}
              <Button 
                onClick={handleSave} 
                className="w-full" 
                size="lg" 
                disabled={saving || editingTemplate.length === 0}
              >
                <Save className="mr-2 h-5 w-5" />
                {saving ? 'Saving...' : 'Save Standing Order'}
              </Button>
            </TabsContent>
          ))}
        </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Standing Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the standing order template for {DAY_NAMES[selectedDay]}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
