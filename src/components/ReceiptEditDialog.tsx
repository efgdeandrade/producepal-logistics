import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  po_number?: string;
}

interface Product {
  code: string;
  name: string;
  pack_size: number;
  wholesale_price_xcg_per_unit: number | null;
}

interface ReceiptEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderItems: OrderItem[];
  selectedCustomers: string[];
  onConfirm: (editedItems: OrderItem[]) => void;
}

export const ReceiptEditDialog = ({
  open,
  onOpenChange,
  orderItems,
  selectedCustomers,
  onConfirm,
}: ReceiptEditDialogProps) => {
  const [editedItems, setEditedItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingForCustomer, setAddingForCustomer] = useState<string | null>(null);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>('');
  const [quantityToAdd, setQuantityToAdd] = useState<number>(1);
  const [movingItem, setMovingItem] = useState<{ itemId: string; fromCustomer: string } | null>(null);
  const [targetCustomer, setTargetCustomer] = useState<string>('');

  useEffect(() => {
    if (open) {
      // Initialize edited items with a deep copy of order items for selected customers only
      const customerItems = orderItems.filter(item => 
        selectedCustomers.includes(item.customer_name)
      );
      setEditedItems(customerItems.map(item => ({ ...item })));
      fetchProducts();
    }
  }, [open, orderItems, selectedCustomers]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('code, name, pack_size, wholesale_price_xcg_per_unit')
      .order('code');
    if (data) setProducts(data);
    setLoading(false);
  };

  const getProductInfo = (code: string): Product | undefined => {
    return products.find(p => p.code === code);
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    setEditedItems(prev => 
      prev.map(item => 
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setEditedItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleAddItem = (customerName: string) => {
    if (!selectedProductToAdd || quantityToAdd <= 0) return;
    
    const newItem: OrderItem = {
      id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      customer_name: customerName,
      product_code: selectedProductToAdd,
      quantity: quantityToAdd,
    };
    
    setEditedItems(prev => [...prev, newItem]);
    setAddingForCustomer(null);
    setSelectedProductToAdd('');
    setQuantityToAdd(1);
  };

  const handleMoveItem = () => {
    if (!movingItem || !targetCustomer) return;
    
    setEditedItems(prev => 
      prev.map(item => 
        item.id === movingItem.itemId 
          ? { ...item, customer_name: targetCustomer }
          : item
      )
    );
    
    setMovingItem(null);
    setTargetCustomer('');
  };

  const getCustomerItems = (customerName: string) => {
    return editedItems.filter(item => item.customer_name === customerName);
  };

  const calculateLineTotal = (item: OrderItem): number => {
    const product = getProductInfo(item.product_code);
    if (!product || !product.wholesale_price_xcg_per_unit) return 0;
    const units = item.quantity * product.pack_size;
    return units * product.wholesale_price_xcg_per_unit;
  };

  const calculateCustomerTotal = (customerName: string): number => {
    return getCustomerItems(customerName).reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const calculateGrandTotal = (): number => {
    return editedItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const handleConfirm = () => {
    onConfirm(editedItems);
  };

  // Get products not already in this customer's list
  const getAvailableProducts = (customerName: string) => {
    const customerProductCodes = getCustomerItems(customerName).map(i => i.product_code);
    return products.filter(p => !customerProductCodes.includes(p.code));
  };

  // Get other customers for move functionality
  const getOtherCustomers = (currentCustomer: string) => {
    return selectedCustomers.filter(c => c !== currentCustomer);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">Loading product data...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Receipt Items</DialogTitle>
          <DialogDescription>
            Adjust quantities, add or remove items. These changes will <strong>NOT</strong> affect the supplier PO.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {selectedCustomers.map((customerName) => {
            const customerItems = getCustomerItems(customerName);
            const customerTotal = calculateCustomerTotal(customerName);

            return (
              <div key={customerName} className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">{customerName}</h3>
                  <span className="font-semibold text-primary">
                    Total: Cg {customerTotal.toFixed(2)}
                  </span>
                </div>

                {customerItems.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    No items for this customer
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Product</th>
                          <th className="text-center py-2 font-medium w-24">Qty (trays)</th>
                          <th className="text-right py-2 font-medium">Price/unit</th>
                          <th className="text-right py-2 font-medium">Total</th>
                          <th className="text-center py-2 font-medium w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerItems.map((item) => {
                          const product = getProductInfo(item.product_code);
                          const units = product ? item.quantity * product.pack_size : 0;
                          const price = product?.wholesale_price_xcg_per_unit || 0;
                          const lineTotal = calculateLineTotal(item);

                          return (
                            <tr key={item.id} className="border-b border-border/50">
                              <td className="py-3">
                                <div className="font-medium">{item.product_code}</div>
                                {product && (
                                  <div className="text-xs text-muted-foreground">{product.name}</div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  ×{product?.pack_size || 1} = {units} units
                                </div>
                              </td>
                              <td className="py-3">
                                <Input
                                  type="number"
                                  min={0}
                                  value={item.quantity}
                                  onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                                  className="w-20 text-center mx-auto"
                                />
                              </td>
                              <td className="py-3 text-right">Cg {price.toFixed(2)}</td>
                              <td className="py-3 text-right font-medium">Cg {lineTotal.toFixed(2)}</td>
                              <td className="py-3">
                                <div className="flex items-center justify-center gap-1">
                                  {selectedCustomers.length > 1 && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setMovingItem({ itemId: item.id, fromCustomer: customerName })}
                                      title="Move to another customer"
                                    >
                                      <ArrowRight className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveItem(item.id)}
                                    title="Remove item"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add Item Section */}
                {addingForCustomer === customerName ? (
                  <div className="mt-4 p-3 bg-muted rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Select value={selectedProductToAdd} onValueChange={setSelectedProductToAdd}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableProducts(customerName).map((product) => (
                            <SelectItem key={product.code} value={product.code}>
                              {product.code} - {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        value={quantityToAdd}
                        onChange={(e) => setQuantityToAdd(parseInt(e.target.value) || 1)}
                        placeholder="Qty (trays)"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAddItem(customerName)}>
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAddingForCustomer(null);
                          setSelectedProductToAdd('');
                          setQuantityToAdd(1);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setAddingForCustomer(customerName)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                )}
              </div>
            );
          })}

          {/* Grand Total */}
          <div className="flex justify-end pt-4 border-t">
            <div className="text-right">
              <span className="text-muted-foreground mr-4">Grand Total:</span>
              <span className="text-xl font-bold">Cg {calculateGrandTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Move Item Dialog */}
        {movingItem && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
            <div className="bg-card border rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg">
              <h4 className="font-semibold mb-4">Move Item to Another Customer</h4>
              <Select value={targetCustomer} onValueChange={setTargetCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
                  {getOtherCustomers(movingItem.fromCustomer).map((customer) => (
                    <SelectItem key={customer} value={customer}>
                      {customer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleMoveItem} disabled={!targetCustomer}>
                  Move
                </Button>
                <Button variant="outline" onClick={() => setMovingItem(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Continue to Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
