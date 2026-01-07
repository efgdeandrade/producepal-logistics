import { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Truck, Package, AlertTriangle, Printer, Save, Scan, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';

interface DeliveryItem {
  id: string;
  customer_id: string;
  customer_name: string;
  product_code: string;
  product_name: string;
  planned_quantity: number;
  delivered_quantity: number | null;
  waste_quantity: number;
  unit_price: number;
  line_total: number;
  adjusted_total: number;
}

interface Delivery {
  id: string;
  delivery_date: string;
  status: string;
  total_amount: number;
  adjusted_amount: number;
  notes: string | null;
  items: DeliveryItem[];
}

const WASTE_REASONS = [
  'expired',
  'damaged',
  'overstocked',
  'quality_issue',
  'returned',
  'other',
];

const DeliveryManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    try {
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*')
        .in('status', ['pending', 'in_transit'])
        .order('delivery_date', { ascending: true });

      if (deliveriesError) throw deliveriesError;

      // Fetch all customers and products for joins
      const { data: allCustomers } = await supabase.from('customers').select('id, name');
      const { data: allProducts } = await supabase.from('products').select('code, name, price_xcg');
      
      const customerMap = new Map(allCustomers?.map(c => [c.id, c.name]) || []);
      const productMap = new Map(allProducts?.map(p => [p.code, { name: p.name, price: p.price_xcg }]) || []);

      const deliveriesWithItems = await Promise.all(
        (deliveriesData || []).map(async (delivery) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from('delivery_items')
            .select('*')
            .eq('delivery_id', delivery.id);

          if (itemsError) throw itemsError;

          const items = (itemsData || []).map(item => {
            const product = productMap.get(item.product_code);
            return {
              id: item.id,
              customer_id: item.customer_id,
              customer_name: customerMap.get(item.customer_id) || 'Unknown',
              product_code: item.product_code,
              product_name: product?.name || item.product_code,
              planned_quantity: item.planned_quantity,
              delivered_quantity: item.delivered_quantity,
              waste_quantity: item.waste_quantity || 0,
              unit_price: item.unit_price || product?.price || 0,
              line_total: item.line_total || 0,
              adjusted_total: item.adjusted_total || 0,
            };
          });

          return { ...delivery, items };
        })
      );

      setDeliveries(deliveriesWithItems);
      if (deliveriesWithItems.length > 0 && !selectedDelivery) {
        setSelectedDelivery(deliveriesWithItems[0]);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateWaste = async (itemId: string, wasteQty: number, reason?: string) => {
    try {
      const item = selectedDelivery?.items.find(i => i.id === itemId);
      if (!item) return;

      const deliveredQty = (item.delivered_quantity || item.planned_quantity) - wasteQty;
      const adjustedTotal = deliveredQty * item.unit_price;

      const { error: updateError } = await supabase
        .from('delivery_items')
        .update({
          waste_quantity: wasteQty,
          delivered_quantity: deliveredQty,
          adjusted_total: adjustedTotal,
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      // Record waste if quantity > 0
      if (wasteQty > 0 && selectedDelivery) {
        const { error: wasteError } = await supabase
          .from('waste_records')
          .insert({
            delivery_id: selectedDelivery.id,
            customer_id: item.customer_id,
            product_code: item.product_code,
            waste_quantity: wasteQty,
            waste_reason: reason || 'unspecified',
          });

        if (wasteError) throw wasteError;
      }

      fetchDeliveries();
      toast({
        title: 'Updated',
        description: 'Waste recorded successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const completeDelivery = async () => {
    if (!selectedDelivery) return;

    try {
      // Fetch wholesale prices for all products in the delivery
      const productCodes = selectedDelivery.items.map(item => item.product_code);
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('code, wholesale_price_xcg_per_unit')
        .in('code', productCodes);

      if (productsError) throw productsError;

      const priceMap = new Map(
        products?.map(p => [p.code, p.wholesale_price_xcg_per_unit || 0]) || []
      );

      // Calculate totals using wholesale prices and delivered quantities
      const totalAdjusted = selectedDelivery.items.reduce((sum, item) => {
        const deliveredQty = item.delivered_quantity !== null 
          ? item.delivered_quantity 
          : item.planned_quantity - item.waste_quantity;
        const wholesalePrice = priceMap.get(item.product_code) || 0;
        return sum + (deliveredQty * wholesalePrice);
      }, 0);

      const { error: deliveryError } = await supabase
        .from('deliveries')
        .update({
          status: 'delivered',
          adjusted_amount: totalAdjusted,
        })
        .eq('id', selectedDelivery.id);

      if (deliveryError) throw deliveryError;

      // Generate invoice
      const invoiceNumber = `INV-${format(new Date(), 'yyyyMMdd')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          delivery_id: selectedDelivery.id,
          customer_id: selectedDelivery.items[0]?.customer_id,
          invoice_date: new Date().toISOString().split('T')[0],
          subtotal: totalAdjusted,
          total: totalAdjusted,
          waste_adjustment: selectedDelivery.total_amount - totalAdjusted,
          adjusted_total: totalAdjusted,
          status: 'draft',
        });

      if (invoiceError) throw invoiceError;

      fetchDeliveries();
      toast({
        title: 'Success',
        description: `Delivery completed. Invoice ${invoiceNumber} generated.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const printInvoice = () => {
    if (!selectedDelivery) return;
    
    // In production, this would trigger actual printing
    toast({
      title: 'Printing',
      description: 'Invoice sent to portable printer',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Package className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Group items by customer
  const groupedItems = selectedDelivery?.items.reduce((acc, item) => {
    if (!acc[item.customer_name]) {
      acc[item.customer_name] = [];
    }
    acc[item.customer_name].push(item);
    return acc;
  }, {} as { [key: string]: DeliveryItem[] });

  const totalWaste = selectedDelivery?.items.reduce((sum, item) => sum + item.waste_quantity, 0) || 0;
  const totalAdjustment = selectedDelivery?.items.reduce(
    (sum, item) => sum + (item.line_total - (item.adjusted_total || item.line_total)),
    0
  ) || 0;

  return (
    <div className="container py-8">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Delivery Management</h1>
            <p className="text-muted-foreground">Scan waste and adjust invoices on delivery</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Delivery List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Active Deliveries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {deliveries.map((delivery) => (
                <Button
                  key={delivery.id}
                  variant={selectedDelivery?.id === delivery.id ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setSelectedDelivery(delivery)}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  <div className="text-left">
                    <div>{format(new Date(delivery.delivery_date), 'MMM d')}</div>
                    <div className="text-xs opacity-70">{delivery.items.length} items</div>
                  </div>
                </Button>
              ))}
              {deliveries.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No active deliveries
                </p>
              )}
            </CardContent>
          </Card>

          {/* Delivery Details */}
          <div className="lg:col-span-3 space-y-6">
            {selectedDelivery ? (
              <>
                {/* Summary */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Delivery #{selectedDelivery.id.slice(0, 8)}</CardTitle>
                        <CardDescription>
                          {format(new Date(selectedDelivery.delivery_date), 'EEEE, MMMM d, yyyy')}
                        </CardDescription>
                      </div>
                      <Badge>{selectedDelivery.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Total Items</div>
                        <div className="text-2xl font-bold">{selectedDelivery.items.length}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Waste</div>
                        <div className="text-2xl font-bold text-orange-500">{totalWaste}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Adjustment</div>
                        <div className="text-2xl font-bold text-red-500">
                          ${totalAdjustment.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Items by Customer */}
                {groupedItems && Object.entries(groupedItems).map(([customerName, items]) => (
                  <Card key={customerName}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        {customerName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {items.map((item) => (
                          <div key={item.id} className="grid grid-cols-12 gap-4 items-center p-4 border rounded-lg">
                            <div className="col-span-4">
                              <div className="font-medium">{item.product_name}</div>
                              <div className="text-sm text-muted-foreground">
                                ${item.unit_price.toFixed(2)} per unit
                              </div>
                            </div>
                            <div className="col-span-2 text-center">
                              <div className="text-sm text-muted-foreground">Planned</div>
                              <div className="text-lg font-bold">{item.planned_quantity}</div>
                            </div>
                            <div className="col-span-2">
                              <Label htmlFor={`waste-${item.id}`} className="text-xs">
                                Waste <Scan className="inline h-3 w-3" />
                              </Label>
                              <Input
                                id={`waste-${item.id}`}
                                type="number"
                                min="0"
                                max={item.planned_quantity}
                                value={item.waste_quantity}
                                onChange={(e) => updateWaste(item.id, parseInt(e.target.value) || 0)}
                                className="text-center"
                              />
                            </div>
                            <div className="col-span-2 text-center">
                              <div className="text-sm text-muted-foreground">Delivered</div>
                              <div className="text-lg font-bold text-green-600">
                                {(item.delivered_quantity !== null ? item.delivered_quantity : item.planned_quantity) - item.waste_quantity}
                              </div>
                            </div>
                            <div className="col-span-2 text-right">
                              <div className="text-sm text-muted-foreground line-through">
                                ${item.line_total.toFixed(2)}
                              </div>
                              <div className="text-lg font-bold text-primary">
                                ${(item.adjusted_total || item.line_total).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Actions */}
                <div className="flex gap-4">
                  <Button onClick={completeDelivery} size="lg" className="flex-1">
                    <Save className="mr-2 h-5 w-5" />
                    Complete Delivery
                  </Button>
                  <Button onClick={printInvoice} variant="outline" size="lg" className="flex-1">
                    <Printer className="mr-2 h-5 w-5" />
                    Print Invoice
                  </Button>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-16">
                  <Truck className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-xl text-muted-foreground">Select a delivery to manage</p>
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryManagement;
