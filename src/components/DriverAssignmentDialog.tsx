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
import { Plus, Trash2, Users, Package } from 'lucide-react';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
}

interface DriverAssignment {
  id?: string;
  driver_name: string;
  driver_id?: string;
  customer_names: string[];
  sequence_number: number;
}

interface Product {
  code: string;
  name: string;
  pack_size: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderItems: OrderItem[];
  onConfirm: (assignments: DriverAssignment[]) => void;
}

export const DriverAssignmentDialog = ({ 
  open, 
  onOpenChange, 
  orderId, 
  orderItems,
  onConfirm 
}: Props) => {
  const [drivers, setDrivers] = useState<DriverAssignment[]>([]);
  const [newDriverName, setNewDriverName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [existingDrivers, setExistingDrivers] = useState<{id: string; full_name: string}[]>([]);

  // Get all unique customers from order
  const allCustomers = useMemo(() => {
    return [...new Set(orderItems.map(item => item.customer_name))].sort();
  }, [orderItems]);

  // Get assigned customers (flat list)
  const assignedCustomers = useMemo(() => {
    return drivers.flatMap(d => d.customer_names);
  }, [drivers]);

  // Get unassigned customers
  const unassignedCustomers = useMemo(() => {
    return allCustomers.filter(c => !assignedCustomers.includes(c));
  }, [allCustomers, assignedCustomers]);

  useEffect(() => {
    if (open) {
      fetchProducts();
      fetchExistingDrivers();
      fetchExistingAssignments();
    }
  }, [open, orderId]);

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
        sequence_number: d.sequence_number || 0
      })));
    } else {
      setDrivers([]);
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
      sequence_number: prev.length
    }]);
    setNewDriverName('');
  };

  const removeDriver = (index: number) => {
    setDrivers(prev => prev.filter((_, i) => i !== index));
  };

  const toggleCustomerAssignment = (driverIndex: number, customerName: string) => {
    setDrivers(prev => {
      const updated = [...prev];
      const driver = updated[driverIndex];
      
      if (driver.customer_names.includes(customerName)) {
        // Remove customer from this driver
        driver.customer_names = driver.customer_names.filter(c => c !== customerName);
      } else {
        // First remove from any other driver
        updated.forEach(d => {
          d.customer_names = d.customer_names.filter(c => c !== customerName);
        });
        // Then add to this driver
        driver.customer_names = [...driver.customer_names, customerName];
      }
      
      return updated;
    });
  };

  const getProductTotals = (customerNames: string[]) => {
    const totals: Record<string, { code: string; name: string; cases: number; units: number }> = {};
    
    orderItems
      .filter(item => customerNames.includes(item.customer_name))
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
          sequence_number: i
        })));

      if (error) throw error;

      toast.success('Driver assignments saved');
      onConfirm(drivers);
    } catch (error) {
      console.error('Error saving driver assignments:', error);
      toast.error('Failed to save driver assignments');
    } finally {
      setSaving(false);
    }
  };

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
          {unassignedCustomers.length > 0 && (
            <Card className="border-dashed">
              <CardContent className="p-4">
                <h4 className="font-medium text-sm text-muted-foreground mb-2">
                  Unassigned Customers ({unassignedCustomers.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {unassignedCustomers.map(customer => (
                    <Badge key={customer} variant="outline" className="text-muted-foreground">
                      {customer}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Driver Cards */}
          {drivers.map((driver, driverIndex) => {
            const productTotals = getProductTotals(driver.customer_names);
            const totalCases = productTotals.reduce((sum, p) => sum + p.cases, 0);
            const totalUnits = productTotals.reduce((sum, p) => sum + p.units, 0);

            return (
              <Card key={driverIndex}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{driver.driver_name}</h4>
                      <Badge variant="secondary">
                        {driver.customer_names.length} customer{driver.customer_names.length !== 1 ? 's' : ''}
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

                  {/* Customer Checkboxes */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                    {allCustomers.map(customer => {
                      const isAssignedToThis = driver.customer_names.includes(customer);
                      const isAssignedToOther = !isAssignedToThis && assignedCustomers.includes(customer);
                      
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
                            onCheckedChange={() => toggleCustomerAssignment(driverIndex, customer)}
                          />
                          <span className="text-sm truncate">{customer}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Product Totals Preview */}
                  {driver.customer_names.length > 0 && (
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
