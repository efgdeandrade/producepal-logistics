import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Users, Package, Store, UtensilsCrossed, Loader2 } from 'lucide-react';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
}

interface DistributionCustomer {
  id: string;
  name: string;
  products: { name: string; quantity: number; product_code: string }[];
  hasMatchingProducts: boolean;
}

export interface DriverAssignment {
  id?: string;
  driver_name: string;
  driver_id?: string;
  customer_names: string[];
  distribution_customer_ids: string[];
  sequence_number: number;
  include_distribution: boolean;
}

interface Product {
  code: string;
  name: string;
  pack_size: number;
}

interface ProductMapping {
  import_product_code: string;
  distribution_product_id: string;
  conversion_factor: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderItems: OrderItem[];
  deliveryDate: string;
  onConfirm: (assignments: DriverAssignment[]) => void;
}

export const DriverAssignmentDialog = ({ 
  open, 
  onOpenChange, 
  orderId, 
  orderItems,
  deliveryDate,
  onConfirm 
}: Props) => {
  const [drivers, setDrivers] = useState<DriverAssignment[]>([]);
  const [newDriverName, setNewDriverName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [existingDrivers, setExistingDrivers] = useState<{id: string; full_name: string}[]>([]);
  
  // Distribution integration state
  const [includeDistribution, setIncludeDistribution] = useState(false);
  const [distributionCustomers, setDistributionCustomers] = useState<DistributionCustomer[]>([]);
  const [productMappings, setProductMappings] = useState<ProductMapping[]>([]);
  const [loadingDistribution, setLoadingDistribution] = useState(false);

  // Get all unique customers from import order
  const allImportCustomers = useMemo(() => {
    return [...new Set(orderItems.map(item => item.customer_name))].sort();
  }, [orderItems]);

  // Get import product codes
  const importProductCodes = useMemo(() => {
    return [...new Set(orderItems.map(item => item.product_code))];
  }, [orderItems]);

  // Get assigned import customers (flat list)
  const assignedImportCustomers = useMemo(() => {
    return drivers.flatMap(d => d.customer_names);
  }, [drivers]);

  // Get assigned distribution customer IDs
  const assignedDistributionIds = useMemo(() => {
    return drivers.flatMap(d => d.distribution_customer_ids || []);
  }, [drivers]);

  // Get unassigned import customers
  const unassignedImportCustomers = useMemo(() => {
    return allImportCustomers.filter(c => !assignedImportCustomers.includes(c));
  }, [allImportCustomers, assignedImportCustomers]);

  // Get unassigned distribution customers (only those with matching products)
  const unassignedDistributionCustomers = useMemo(() => {
    return distributionCustomers
      .filter(c => c.hasMatchingProducts && !assignedDistributionIds.includes(c.id));
  }, [distributionCustomers, assignedDistributionIds]);

  useEffect(() => {
    if (open) {
      fetchProducts();
      fetchExistingDrivers();
      fetchExistingAssignments();
      fetchProductMappings();
    }
  }, [open, orderId]);

  useEffect(() => {
    if (includeDistribution && deliveryDate) {
      fetchDistributionOrders();
    } else {
      setDistributionCustomers([]);
    }
  }, [includeDistribution, deliveryDate, productMappings]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('code, name, pack_size');
    if (data) setProducts(data);
  };

  const fetchExistingDrivers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name');
    if (data) {
      setExistingDrivers(data.filter(d => d.full_name));
    }
  };

  const fetchProductMappings = async () => {
    const { data } = await supabase
      .from('cross_department_product_mappings')
      .select('import_product_code, distribution_product_id, conversion_factor');
    if (data) setProductMappings(data);
  };

  const fetchExistingAssignments = async () => {
    const { data } = await supabase
      .from('import_order_driver_assignments')
      .select('*')
      .eq('order_id', orderId)
      .order('sequence_number');
    
    if (data && data.length > 0) {
      setDrivers(data.map(d => ({
        id: d.id,
        driver_name: d.driver_name,
        driver_id: d.driver_id || undefined,
        customer_names: d.customer_names || [],
        distribution_customer_ids: d.distribution_customer_ids || [],
        sequence_number: d.sequence_number || 0,
        include_distribution: d.include_distribution || false
      })));
      // If any assignment includes distribution, enable the toggle
      if (data.some(d => d.include_distribution)) {
        setIncludeDistribution(true);
      }
    } else {
      setDrivers([]);
    }
  };

  const fetchDistributionOrders = async () => {
    if (!deliveryDate || productMappings.length === 0) return;
    
    setLoadingDistribution(true);
    try {
      // Get mapped distribution product IDs for our import products
      const mappedDistProductIds = productMappings
        .filter(m => importProductCodes.includes(m.import_product_code))
        .map(m => m.distribution_product_id);

      // Fetch distribution orders for this date
      const { data: orders } = await supabase
        .from('distribution_orders')
        .select(`
          id,
          customer_id,
          distribution_customers!inner(id, name),
          distribution_order_items(
            id,
            quantity,
            product_id,
            distribution_products(id, name, code)
          )
        `)
        .eq('delivery_date', deliveryDate)
        .in('status', ['confirmed', 'pending', 'picking', 'ready']);

      if (orders) {
        const customerMap = new Map<string, DistributionCustomer>();
        
        orders.forEach(order => {
          const customer = order.distribution_customers;
          if (!customer) return;

          const items = (order.distribution_order_items || []).map((item: any) => ({
            name: item.distribution_products?.name || 'Unknown',
            quantity: item.quantity,
            product_code: item.distribution_products?.code || '',
            product_id: item.product_id
          }));

          const hasMatchingProducts = items.some((item: any) => 
            mappedDistProductIds.includes(item.product_id)
          );

          if (!customerMap.has(customer.id)) {
            customerMap.set(customer.id, {
              id: customer.id,
              name: customer.name,
              products: items,
              hasMatchingProducts
            });
          } else {
            const existing = customerMap.get(customer.id)!;
            existing.products.push(...items);
            existing.hasMatchingProducts = existing.hasMatchingProducts || hasMatchingProducts;
          }
        });

        setDistributionCustomers(Array.from(customerMap.values()));
      }
    } catch (error) {
      console.error('Error fetching distribution orders:', error);
      toast.error('Failed to load Distribution orders');
    } finally {
      setLoadingDistribution(false);
    }
  };

  const addDriver = () => {
    if (!newDriverName.trim()) {
      toast.error('Please enter a driver name');
      return;
    }
    
    // Check for duplicate
    if (drivers.some(d => d.driver_name.toLowerCase() === newDriverName.trim().toLowerCase())) {
      toast.error('Driver already added');
      return;
    }

    const existingDriver = existingDrivers.find(
      d => d.full_name?.toLowerCase() === newDriverName.trim().toLowerCase()
    );

    setDrivers(prev => [...prev, {
      driver_name: newDriverName.trim(),
      driver_id: existingDriver?.id,
      customer_names: [],
      distribution_customer_ids: [],
      sequence_number: prev.length,
      include_distribution: includeDistribution
    }]);
    setNewDriverName('');
  };

  const removeDriver = (index: number) => {
    setDrivers(prev => prev.filter((_, i) => i !== index));
  };

  const toggleImportCustomerAssignment = (driverIndex: number, customerName: string) => {
    setDrivers(prev => {
      const updated = [...prev];
      const driver = updated[driverIndex];
      
      if (driver.customer_names.includes(customerName)) {
        driver.customer_names = driver.customer_names.filter(c => c !== customerName);
      } else {
        updated.forEach(d => {
          d.customer_names = d.customer_names.filter(c => c !== customerName);
        });
        driver.customer_names = [...driver.customer_names, customerName];
      }
      
      return updated;
    });
  };

  const toggleDistributionCustomerAssignment = (driverIndex: number, customerId: string) => {
    setDrivers(prev => {
      const updated = [...prev];
      const driver = updated[driverIndex];
      
      if (driver.distribution_customer_ids?.includes(customerId)) {
        driver.distribution_customer_ids = driver.distribution_customer_ids.filter(c => c !== customerId);
      } else {
        updated.forEach(d => {
          if (d.distribution_customer_ids) {
            d.distribution_customer_ids = d.distribution_customer_ids.filter(c => c !== customerId);
          }
        });
        driver.distribution_customer_ids = [...(driver.distribution_customer_ids || []), customerId];
      }
      
      return updated;
    });
  };

  const getProductTotals = (importCustomerNames: string[], distCustomerIds: string[]) => {
    const totals: Record<string, { code: string; name: string; cases: number; units: number }> = {};
    
    // Add Import products
    orderItems
      .filter(item => importCustomerNames.includes(item.customer_name))
      .forEach(item => {
        const product = products.find(p => p.code === item.product_code);
        const packSize = product?.pack_size || 1;
        
        if (!totals[item.product_code]) {
          totals[item.product_code] = {
            code: item.product_code,
            name: product?.name || item.product_code,
            cases: 0,
            units: 0
          };
        }
        totals[item.product_code].cases += item.quantity;
        totals[item.product_code].units += item.quantity * packSize;
      });
    
    // Add Distribution products (converted to Import equivalents)
    if (includeDistribution && distCustomerIds.length > 0) {
      distributionCustomers
        .filter(c => distCustomerIds.includes(c.id))
        .forEach(customer => {
          customer.products.forEach(product => {
            // Find mapping for this distribution product
            const mapping = productMappings.find(m => {
              const distProduct = distributionCustomers
                .flatMap(c => c.products)
                .find(p => p.product_code === product.product_code);
              return distProduct && m.distribution_product_id;
            });
            
            if (mapping) {
              const importCode = mapping.import_product_code;
              const importProduct = products.find(p => p.code === importCode);
              const packSize = importProduct?.pack_size || 1;
              const convertedQty = product.quantity * (mapping.conversion_factor || 1);
              
              if (!totals[importCode]) {
                totals[importCode] = {
                  code: importCode,
                  name: importProduct?.name || importCode,
                  cases: 0,
                  units: 0
                };
              }
              totals[importCode].cases += convertedQty;
              totals[importCode].units += convertedQty * packSize;
            }
          });
        });
    }
    
    return Object.values(totals);
  };

  const handleSave = async () => {
    if (drivers.length === 0) {
      toast.error('Please add at least one driver');
      return;
    }

    setSaving(true);
    try {
      // Delete existing assignments for this order
      await supabase
        .from('import_order_driver_assignments')
        .delete()
        .eq('order_id', orderId);

      // Insert new assignments
      const { error } = await supabase
        .from('import_order_driver_assignments')
        .insert(drivers.map((d, i) => ({
          order_id: orderId,
          driver_name: d.driver_name,
          driver_id: d.driver_id || null,
          customer_names: d.customer_names,
          distribution_customer_ids: d.distribution_customer_ids || [],
          sequence_number: i,
          include_distribution: includeDistribution
        })));

      if (error) throw error;

      toast.success('Driver assignments saved');
      onConfirm(drivers.map(d => ({
        ...d,
        include_distribution: includeDistribution
      })));
    } catch (error) {
      console.error('Error saving driver assignments:', error);
      toast.error('Failed to save driver assignments');
    } finally {
      setSaving(false);
    }
  };

  const matchingDistCustomersCount = distributionCustomers.filter(c => c.hasMatchingProducts).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Customers to Drivers
          </DialogTitle>
          <DialogDescription>
            Plan delivery routes by assigning customers to drivers. Each driver will get a packing slip with aggregated product totals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Distribution Toggle */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                  <div>
                    <Label htmlFor="include-distribution" className="font-medium">
                      Include Distribution orders for {deliveryDate}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Add Restaurant/Hotel customers with matching products to driver routes
                    </p>
                  </div>
                </div>
                <Switch
                  id="include-distribution"
                  checked={includeDistribution}
                  onCheckedChange={setIncludeDistribution}
                />
              </div>
              {includeDistribution && (
                <div className="mt-3 pt-3 border-t text-sm">
                  {loadingDistribution ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading Distribution orders...
                    </div>
                  ) : matchingDistCustomersCount > 0 ? (
                    <div className="flex items-center gap-2 text-primary">
                      <Badge variant="secondary">{matchingDistCustomersCount}</Badge>
                      Distribution customer{matchingDistCustomersCount !== 1 ? 's' : ''} with matching products found
                    </div>
                  ) : productMappings.length === 0 ? (
                    <p className="text-amber-600">
                      No product mappings configured. Go to Settings → Product Mappings to link Import and Distribution products.
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      No Distribution orders with matching products for this date
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Driver Section */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter driver name..."
              value={newDriverName}
              onChange={(e) => setNewDriverName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDriver()}
              list="existing-drivers"
            />
            <datalist id="existing-drivers">
              {existingDrivers.map(d => (
                <option key={d.id} value={d.full_name} />
              ))}
            </datalist>
            <Button onClick={addDriver} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Driver
            </Button>
          </div>

          {/* Unassigned Customers */}
          {(unassignedImportCustomers.length > 0 || unassignedDistributionCustomers.length > 0) && (
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-3">
                {unassignedImportCustomers.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Unassigned Import Customers ({unassignedImportCustomers.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {unassignedImportCustomers.map(customer => (
                        <Badge key={customer} variant="outline" className="text-muted-foreground">
                          {customer}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {includeDistribution && unassignedDistributionCustomers.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <UtensilsCrossed className="h-4 w-4" />
                      Unassigned Distribution Customers ({unassignedDistributionCustomers.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {unassignedDistributionCustomers.map(customer => (
                        <Badge key={customer.id} variant="outline" className="text-primary border-primary/50">
                          {customer.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Driver Cards */}
          {drivers.map((driver, driverIndex) => {
            const productTotals = getProductTotals(
              driver.customer_names, 
              driver.distribution_customer_ids || []
            );
            const totalCases = productTotals.reduce((sum, p) => sum + p.cases, 0);
            const totalUnits = productTotals.reduce((sum, p) => sum + p.units, 0);
            const totalStops = driver.customer_names.length + (driver.distribution_customer_ids?.length || 0);

            return (
              <Card key={driverIndex}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{driver.driver_name}</h4>
                      <Badge variant="secondary">
                        {totalStops} stop{totalStops !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDriver(driverIndex)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  {/* Import Customer Checkboxes */}
                  <div className="mb-4">
                    <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Import Customers (Supermarkets)
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {allImportCustomers.map(customer => {
                        const isAssignedToThis = driver.customer_names.includes(customer);
                        const isAssignedToOther = !isAssignedToThis && assignedImportCustomers.includes(customer);
                        
                        return (
                          <label
                            key={customer}
                            className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                              isAssignedToThis 
                                ? 'bg-primary/10 border-primary' 
                                : isAssignedToOther 
                                  ? 'opacity-50 bg-muted' 
                                  : 'hover:bg-accent'
                            }`}
                          >
                            <Checkbox
                              checked={isAssignedToThis}
                              onCheckedChange={() => toggleImportCustomerAssignment(driverIndex, customer)}
                            />
                            <span className="text-sm truncate">{customer}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Distribution Customer Checkboxes */}
                  {includeDistribution && distributionCustomers.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4" />
                        Distribution Customers (Restaurants/Hotels)
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {distributionCustomers.map(customer => {
                          const isAssignedToThis = driver.distribution_customer_ids?.includes(customer.id);
                          const isAssignedToOther = !isAssignedToThis && assignedDistributionIds.includes(customer.id);
                          const isDisabled = !customer.hasMatchingProducts;
                          
                          return (
                            <label
                              key={customer.id}
                              className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                                isDisabled
                                  ? 'opacity-30 cursor-not-allowed bg-muted'
                                  : isAssignedToThis 
                                    ? 'bg-primary/10 border-primary' 
                                    : isAssignedToOther 
                                      ? 'opacity-50 bg-muted' 
                                      : 'hover:bg-accent'
                              }`}
                              title={isDisabled ? 'No matching products for this customer' : undefined}
                            >
                              <Checkbox
                                checked={isAssignedToThis}
                                onCheckedChange={() => !isDisabled && toggleDistributionCustomerAssignment(driverIndex, customer.id)}
                                disabled={isDisabled}
                              />
                              <span className="text-sm truncate">{customer.name}</span>
                              {!customer.hasMatchingProducts && (
                                <Badge variant="outline" className="text-xs ml-auto">No match</Badge>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Product Totals Preview */}
                  {totalStops > 0 && (
                    <div className="bg-muted/50 rounded p-3">
                      <div className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Package className="h-4 w-4" />
                        Products to Load
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {productTotals.map(product => (
                          <div key={product.code} className="flex justify-between">
                            <span className="truncate text-muted-foreground">{product.name}</span>
                            <span className="font-medium">{product.cases} ({product.units})</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t text-sm font-semibold">
                        Total: {totalCases} cases = {totalUnits} units
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {drivers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No drivers added yet</p>
              <p className="text-sm">Add a driver to start assigning customers</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || drivers.length === 0}>
            {saving ? 'Saving...' : 'Generate Packing Slips'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
