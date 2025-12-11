import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
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
}

interface Customer {
  id: string;
  name: string;
}

interface TemplateCustomer {
  id: string;
  customerId: string;
  customerName: string;
  products: Array<{
    id: string;
    productCode: string;
    productName: string;
    quantity: number;
  }>;
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
    const [customersRes, productsRes] = await Promise.all([
      supabase.from('customers').select('id, name').order('name'),
      supabase.from('products').select('id, code, name, pack_size').order('name'),
    ]);

    if (customersRes.data) setCustomers(customersRes.data);
    if (productsRes.data) setProducts(productsRes.data);
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
      
      const existing = customerMap.get(item.customer_id);
      if (existing) {
        existing.products.push({
          id: Date.now().toString() + Math.random(),
          productCode: item.product_code,
          productName: product?.name || item.product_code,
          quantity: item.default_quantity,
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
            quantity: item.default_quantity,
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
          quantity: 0,
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

  const updateProductQuantity = (customerId: string, productId: string, quantity: number) => {
    setEditingTemplate(editingTemplate.map(c =>
      c.id === customerId
        ? {
            ...c,
            products: c.products.map(p =>
              p.id === productId ? { ...p, quantity } : p
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
        default_quantity: product.quantity,
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
        
        const existing = customerMap.get(item.customer_id);
        if (existing) {
          existing.products.push({
            id: Date.now().toString() + Math.random(),
            productCode: item.product_code,
            productName: product?.name || item.product_code,
            quantity: item.default_quantity,
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
              quantity: item.default_quantity,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-8 text-center">
          <p className="text-muted-foreground">Loading standing orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
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
              
              return (
                <TabsTrigger 
                  key={day} 
                  value={day.toString()}
                  className="relative"
                >
                  {DAY_NAMES[day]}
                  {itemCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
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
                              <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Default Trays</th>
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
                                    value={product.quantity || ''}
                                    onChange={(e) => updateProductQuantity(
                                      customer.id, 
                                      product.id, 
                                      parseInt(e.target.value) || 0
                                    )}
                                    className="w-24 ml-auto"
                                  />
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
      </main>

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
