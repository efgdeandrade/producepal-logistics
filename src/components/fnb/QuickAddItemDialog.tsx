import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Search, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QuickAddItemDialogProps {
  orderId: string;
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickAddItemDialog({ 
  orderId, 
  orderNumber, 
  open, 
  onOpenChange 
}: QuickAddItemDialogProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');

  // Fetch available products
  const { data: products, isLoading } = useQuery({
    queryKey: ['fnb-products-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_products')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error('No product selected');
      
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) throw new Error('Invalid quantity');

      // Add item to order
      const { error: itemError } = await supabase
        .from('fnb_order_items')
        .insert({
          order_id: orderId,
          product_id: selectedProduct.id,
          quantity: qty,
          unit_price_xcg: selectedProduct.price_xcg,
          total_xcg: qty * selectedProduct.price_xcg,
        });
      if (itemError) throw itemError;

      // Update order total
      const { data: items } = await supabase
        .from('fnb_order_items')
        .select('total_xcg')
        .eq('order_id', orderId);
      
      const newTotal = items?.reduce((sum, item) => sum + (item.total_xcg || 0), 0) || 0;
      
      const { error: orderError } = await supabase
        .from('fnb_orders')
        .update({ total_xcg: newTotal })
        .eq('id', orderId);
      if (orderError) throw orderError;

      // Log the modification
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('fnb_order_modifications').insert({
        order_id: orderId,
        modified_by: user?.id,
        modified_by_email: user?.email,
        modification_type: 'item_added',
        new_value: {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          quantity: qty,
          unit_price_xcg: selectedProduct.price_xcg,
        },
        notes: `Added ${qty} x ${selectedProduct.name}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fnb-orders'] });
      queryClient.invalidateQueries({ queryKey: ['fnb-order-items'] });
      toast.success(`Added ${quantity} x ${selectedProduct.name} to order`);
      setSelectedProduct(null);
      setQuantity('1');
      setSearchTerm('');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add item');
    },
  });

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleAddItem = () => {
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }
    addItemMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Quick Add Item to {orderNumber}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Product Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Product List */}
          <ScrollArea className="h-48 border rounded-lg">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No products found</div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`w-full p-2 rounded-lg text-left transition-colors flex items-center justify-between ${
                      selectedProduct?.id === product.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className={`text-xs ${
                          selectedProduct?.id === product.id 
                            ? 'text-primary-foreground/70' 
                            : 'text-muted-foreground'
                        }`}>
                          {product.code} • {product.price_xcg.toFixed(2)} XCG/{product.unit}
                        </p>
                      </div>
                    </div>
                    {selectedProduct?.id === product.id && (
                      <Badge variant="secondary" className="text-xs">Selected</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected Product & Quantity */}
          {selectedProduct && (
            <div className="p-3 bg-muted rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedProduct.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedProduct.price_xcg.toFixed(2)} XCG per {selectedProduct.unit}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground">Quantity ({selectedProduct.unit})</label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="0.1"
                    step={selectedProduct.is_weight_based ? '0.1' : '1'}
                    className="mt-1"
                  />
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-semibold text-lg">
                    {(parseFloat(quantity || '0') * selectedProduct.price_xcg).toFixed(2)} XCG
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1"
              onClick={handleAddItem}
              disabled={!selectedProduct || addItemMutation.isPending}
            >
              {addItemMutation.isPending ? 'Adding...' : 'Add Item'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}