import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase as supabaseClient } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ResponsiveSearchableSelect } from '@/components/ui/responsive-searchable-select';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw, 
  Package,
  Users,
  Calendar,
  Loader2,
  ChevronDown,
  UserPlus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFnbStandingOrders } from '@/hooks/useFnbStandingOrders';

// Cast the backend client to `any` in this page to avoid excessively-deep type instantiation errors
const supabase = supabaseClient as any;

interface EditingItem {
  customer_id: string;
  product_id: string;
  default_quantity: number;
  default_price_xcg: number | null;
}

interface EditingTemplate {
  name: string;
  notes: string;
  items: EditingItem[];
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function FnbStandingOrders() {
  const [selectedDay, setSelectedDay] = useState('1');
  const [editingTemplate, setEditingTemplate] = useState<EditingTemplate>({
    name: 'Standing Order',
    notes: '',
    items: [],
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState('');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const {
    templates,
    loading,
    createOrUpdateTemplate,
    deleteTemplate,
    generateTemplateFromLastWeek,
  } = useFnbStandingOrders();

  // Fetch customers and products
  const { data: customers = [] } = useQuery({
    queryKey: ['fnb-customers-for-standing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_customers')
        .select('id, name, whatsapp_phone')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['fnb-products-for-standing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_products')
        .select('id, code, name, price_xcg, unit')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Load template when day changes
  useEffect(() => {
    const dayNum = parseInt(selectedDay);
    const template = templates.find(t => t.day_of_week === dayNum);
    
    if (template) {
      setEditingTemplate({
        name: template.template_name,
        notes: template.notes || '',
        items: template.items.map(item => ({
          customer_id: item.customer_id,
          product_id: item.product_id,
          default_quantity: item.default_quantity,
          default_price_xcg: item.default_price_xcg,
        })),
      });
      // Expand all customers by default when loading existing template
      const customerIds = new Set(template.items.map(i => i.customer_id));
      setExpandedCustomers(customerIds);
    } else {
      setEditingTemplate({
        name: `${DAY_NAMES[dayNum]} Standing Order`,
        notes: '',
        items: [],
      });
      setExpandedCustomers(new Set());
    }
  }, [selectedDay, templates]);

  // Add a new standing order (customer with first product)
  const handleAddStandingOrder = () => {
    if (!newCustomerId || products.length === 0) return;
    
    // Check if customer already exists in template
    const existingItems = editingTemplate.items.filter(i => i.customer_id === newCustomerId);
    if (existingItems.length > 0) {
      // Just expand the customer if they already exist
      setExpandedCustomers(prev => new Set([...prev, newCustomerId]));
      setNewCustomerId('');
      return;
    }
    
    // Add first item for this customer
    setEditingTemplate(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          customer_id: newCustomerId,
          product_id: products[0].id,
          default_quantity: 1,
          default_price_xcg: products[0].price_xcg,
        },
      ],
    }));
    
    // Expand the new customer
    setExpandedCustomers(prev => new Set([...prev, newCustomerId]));
    setNewCustomerId('');
  };

  // Add item to specific customer
  const handleAddItemToCustomer = (customerId: string) => {
    if (products.length === 0) return;
    
    setEditingTemplate(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          customer_id: customerId,
          product_id: products[0].id,
          default_quantity: 1,
          default_price_xcg: products[0].price_xcg,
        },
      ],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setEditingTemplate(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleRemoveCustomer = (customerId: string) => {
    setEditingTemplate(prev => ({
      ...prev,
      items: prev.items.filter(item => item.customer_id !== customerId),
    }));
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      next.delete(customerId);
      return next;
    });
  };

  const handleUpdateItem = (index: number, field: keyof EditingItem, value: any) => {
    setEditingTemplate(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Update price when product changes
      if (field === 'product_id') {
        const product = products.find(p => p.id === value);
        if (product) {
          newItems[index].default_price_xcg = product.price_xcg;
        }
      }
      
      return { ...prev, items: newItems };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await createOrUpdateTemplate(
        parseInt(selectedDay),
        editingTemplate.name,
        editingTemplate.items.map((item, index) => ({
          ...item,
          sort_order: index,
        })),
        editingTemplate.notes || undefined
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const dayNum = parseInt(selectedDay);
    const template = templates.find(t => t.day_of_week === dayNum);
    if (template) {
      await deleteTemplate(template.id);
    }
  };

  const handleGenerateFromLastWeek = async () => {
    setGenerating(true);
    try {
      const items = await generateTemplateFromLastWeek(parseInt(selectedDay));
      if (items.length > 0) {
        setEditingTemplate(prev => ({
          ...prev,
          items: items.map(item => ({
            customer_id: item.customer_id,
            product_id: item.product_id,
            default_quantity: item.default_quantity,
            default_price_xcg: item.default_price_xcg ?? null,
          })),
        }));
        // Expand all customers
        const customerIds = new Set(items.map(i => i.customer_id));
        setExpandedCustomers(customerIds);
      }
    } finally {
      setGenerating(false);
    }
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  };

  const toggleCustomerExpanded = (customerId: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  // Group items by customer for display
  const itemsByCustomer = editingTemplate.items.reduce((acc, item, index) => {
    if (!acc[item.customer_id]) {
      acc[item.customer_id] = [];
    }
    acc[item.customer_id].push({ ...item, originalIndex: index });
    return acc;
  }, {} as Record<string, (EditingItem & { originalIndex: number })[]>);

  // Get customers already in template
  const customersInTemplate = new Set(Object.keys(itemsByCustomer));
  
  // Customer options for SearchableSelect
  const customerOptions = customers.map(c => ({
    value: c.id,
    label: c.name,
    searchTerms: `${c.name} ${c.whatsapp_phone || ''}`,
  }));

  // Product options for SearchableSelect
  const productOptions = products.map(p => ({
    value: p.id,
    label: `${p.code} - ${p.name}`,
    searchTerms: `${p.code} ${p.name}`,
  }));

  const currentTemplate = templates.find(t => t.day_of_week === parseInt(selectedDay));

  if (loading) {
    return (
      <div className="px-4 md:container py-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden px-4 md:container py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/distribution">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Standing Orders</h1>
          <p className="text-muted-foreground">
            Configure recurring orders for each day of the week
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map(day => {
          const template = templates.find(t => t.day_of_week === day);
          const itemCount = template?.items.length || 0;
          const customerCount = template 
            ? new Set(template.items.map(i => i.customer_id)).size 
            : 0;

          return (
            <Card 
              key={day} 
              className={`cursor-pointer transition-all ${
                selectedDay === String(day) 
                  ? 'ring-2 ring-primary' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => setSelectedDay(String(day))}
            >
              <CardContent className="p-4 text-center">
                <div className="font-medium text-sm">{DAY_NAMES[day].slice(0, 3)}</div>
                {template ? (
                  <div className="mt-1">
                    <Badge variant="default" className="text-xs">
                      {customerCount} customers
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {itemCount} items
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mt-1">No template</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Template Editor */}
      <Tabs value={selectedDay} onValueChange={setSelectedDay}>
        <TabsList className="grid w-full grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map(day => (
            <TabsTrigger key={day} value={String(day)}>
              {DAY_NAMES[day].slice(0, 3)}
            </TabsTrigger>
          ))}
        </TabsList>

        {[1, 2, 3, 4, 5, 6].map(day => (
          <TabsContent key={day} value={String(day)} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {DAY_NAMES[day]} Template
                    </CardTitle>
                    <CardDescription>
                      {currentTemplate 
                        ? `${editingTemplate.items.length} items for ${Object.keys(itemsByCustomer).length} customers`
                        : 'No template configured yet'
                      }
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateFromLastWeek}
                    disabled={generating}
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Generate from Last {DAY_NAMES[day]}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Template Name */}
                <div className="grid gap-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={editingTemplate.name}
                    onChange={e => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Standing Order"
                  />
                </div>

                {/* Add Standing Order Section */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add Standing Order
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <ResponsiveSearchableSelect
                        options={customerOptions}
                        value={newCustomerId}
                        onValueChange={setNewCustomerId}
                        placeholder="Select customer..."
                        emptyMessage="No customers found"
                      />
                    </div>
                    <Button 
                      onClick={handleAddStandingOrder}
                      disabled={!newCustomerId}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Standing Order
                    </Button>
                  </div>
                </div>

                {/* Customer Standing Orders */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Standing Orders ({Object.keys(itemsByCustomer).length} customers)
                  </Label>

                  {editingTemplate.items.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No standing orders configured</p>
                      <p className="text-sm">Select a customer above to add their standing order</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(itemsByCustomer).map(([customerId, customerItems]) => (
                        <Card key={customerId} className="border-l-4 border-l-primary">
                          <Collapsible
                            open={expandedCustomers.has(customerId)}
                            onOpenChange={() => toggleCustomerExpanded(customerId)}
                          >
                            <CollapsibleTrigger asChild>
                              <CardHeader className="py-3 cursor-pointer hover:bg-muted/50">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    {getCustomerName(customerId)}
                                    <Badge variant="secondary">
                                      {customerItems.length} items
                                    </Badge>
                                  </CardTitle>
                                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedCustomers.has(customerId) ? 'rotate-180' : ''}`} />
                                </div>
                              </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <CardContent className="pt-0 space-y-3">
                                {/* Item rows */}
                                {customerItems.map((item) => {
                                  const product = products.find(p => p.id === item.product_id);
                                  return (
                                    <div 
                                      key={item.originalIndex} 
                                      className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                                    >
                                      <div className="flex-1">
                                        <ResponsiveSearchableSelect
                                          options={productOptions}
                                          value={item.product_id}
                                          onValueChange={v => handleUpdateItem(item.originalIndex, 'product_id', v)}
                                          placeholder="Select product..."
                                          emptyMessage="No products found"
                                        />
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="number"
                                          className="w-20"
                                          value={item.default_quantity}
                                          onChange={e => handleUpdateItem(item.originalIndex, 'default_quantity', parseFloat(e.target.value) || 0)}
                                          min={0}
                                          step={0.5}
                                        />
                                        <span className="text-xs text-muted-foreground w-8">
                                          {product?.unit || 'ea'}
                                        </span>
                                      </div>

                                      <Input
                                        type="number"
                                        className="w-24"
                                        value={item.default_price_xcg || ''}
                                        onChange={e => handleUpdateItem(item.originalIndex, 'default_price_xcg', parseFloat(e.target.value) || null)}
                                        placeholder="Price"
                                        step={0.01}
                                      />

                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveItem(item.originalIndex)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  );
                                })}

                                {/* Add item button and remove customer */}
                                <div className="flex items-center justify-between pt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddItemToCustomer(customerId)}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Item
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveCustomer(customerId)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove Customer
                                  </Button>
                                </div>
                              </CardContent>
                            </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={editingTemplate.notes}
                    onChange={e => setEditingTemplate(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes..."
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t">
                  {currentTemplate && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Template
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete the {DAY_NAMES[day]} standing order template.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  <Button onClick={handleSave} disabled={saving} className="ml-auto">
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
