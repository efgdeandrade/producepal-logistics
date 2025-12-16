import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Phone, MapPin, Package, Clock, Banknote } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function FnbDriverPortal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [codDialogOrder, setCodDialogOrder] = useState<any>(null);
  const [codAmount, setCodAmount] = useState<string>("");

  // Fetch orders assigned to current driver
  const { data: myOrders, isLoading } = useQuery({
    queryKey: ["fnb-driver-orders", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("fnb_orders")
        .select(`
          *,
          fnb_customers (name, address, whatsapp_phone),
          fnb_order_items (id, quantity, picked_quantity, short_quantity, product_id, fnb_products (name))
        `)
        .eq("driver_id", user.id)
        .in("status", ["out_for_delivery"])
        .order("delivery_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch delivered orders (for history)
  const { data: deliveredOrders } = useQuery({
    queryKey: ["fnb-driver-delivered", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("fnb_orders")
        .select(`
          *,
          fnb_customers (name, address)
        `)
        .eq("driver_id", user.id)
        .eq("status", "delivered")
        .gte("delivered_at", today)
        .order("delivered_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Calculate today's COD total
  const todayCodTotal = deliveredOrders?.reduce((sum, order) => {
    return sum + (order.cod_amount_collected || 0);
  }, 0) || 0;

  // Mark as delivered mutation with COD
  const markDeliveredMutation = useMutation({
    mutationFn: async ({ orderId, codCollected }: { orderId: string; codCollected: number }) => {
      const { error } = await supabase
        .from("fnb_orders")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
          cod_amount_collected: codCollected,
          cod_collected_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order delivered & COD recorded!");
      queryClient.invalidateQueries({ queryKey: ["fnb-driver-orders"] });
      queryClient.invalidateQueries({ queryKey: ["fnb-driver-delivered"] });
      setCodDialogOrder(null);
      setCodAmount("");
    },
    onError: (error) => {
      toast.error("Failed to update order: " + error.message);
    },
  });

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, "_self");
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}`, "_blank");
  };

  const openCodDialog = (order: any) => {
    setCodDialogOrder(order);
    setCodAmount(order.total_xcg?.toFixed(2) || "0");
  };

  const handleConfirmDelivery = () => {
    if (!codDialogOrder) return;
    const amount = parseFloat(codAmount) || 0;
    markDeliveredMutation.mutate({
      orderId: codDialogOrder.id,
      codCollected: amount,
    });
  };

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-lg">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/fnb")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">My Deliveries</h1>
          <p className="text-muted-foreground">
            {myOrders?.length || 0} orders to deliver
          </p>
        </div>
      </div>

      {/* Today's COD Summary */}
      {todayCodTotal > 0 && (
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-green-600" />
                <span className="font-medium">Today's COD Collected</span>
              </div>
              <span className="text-xl font-bold text-green-600">{todayCodTotal.toFixed(2)} XCG</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Deliveries */}
      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">Loading...</p>
      ) : myOrders?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">All done!</p>
            <p className="text-muted-foreground">No pending deliveries</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {myOrders?.map((order, index) => (
            <Card
              key={order.id}
              className="overflow-hidden"
              onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
            >
              <CardHeader className="pb-2 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{order.fnb_customers?.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{order.order_number}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{order.fnb_order_items?.length} items</Badge>
                    {order.payment_method === 'cod' && (
                      <Badge variant="outline" className="ml-1 text-orange-600 border-orange-300">COD</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Address */}
                {order.fnb_customers?.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <span>{order.fnb_customers.address}</span>
                  </div>
                )}

                {/* Order Total / COD Amount */}
                <div className="flex items-center gap-2 text-sm">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {order.payment_method === 'cod' ? 'COD: ' : ''}
                    {order.total_xcg?.toFixed(2)} XCG
                  </span>
                </div>

                {/* Expanded details */}
                {expandedOrder === order.id && (
                  <div className="pt-2 border-t space-y-3">
                    {/* Items list */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Items:</p>
                      {order.fnb_order_items?.map((item: any) => (
                        <div key={item.id} className="text-sm flex justify-between pl-2">
                          <span>{item.fnb_products?.name}</span>
                          <span className="text-muted-foreground">
                            x{item.picked_quantity || item.quantity}
                            {item.short_quantity > 0 && (
                              <span className="text-destructive ml-1">(-{item.short_quantity})</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    {order.notes && (
                      <div className="text-sm">
                        <p className="font-medium">Notes:</p>
                        <p className="text-muted-foreground">{order.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  {order.fnb_customers?.whatsapp_phone && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCall(order.fnb_customers.whatsapp_phone);
                        }}
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        Call
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWhatsApp(order.fnb_customers.whatsapp_phone);
                        }}
                      >
                        WhatsApp
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCodDialog(order);
                    }}
                    disabled={markDeliveredMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Delivered
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Today's Completed */}
      {deliveredOrders && deliveredOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Completed Today ({deliveredOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deliveredOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{order.fnb_customers?.name}</p>
                  <p className="text-muted-foreground">{order.order_number}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(order.delivered_at), "HH:mm")}
                  </div>
                  {order.cod_amount_collected > 0 && (
                    <p className="text-green-600 font-medium">{order.cod_amount_collected.toFixed(2)} XCG</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* COD Collection Dialog */}
      <Dialog open={!!codDialogOrder} onOpenChange={() => setCodDialogOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record COD Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              <p>Customer: <span className="font-medium text-foreground">{codDialogOrder?.fnb_customers?.name}</span></p>
              <p>Order: <span className="font-medium text-foreground">{codDialogOrder?.order_number}</span></p>
              <p>Order Total: <span className="font-medium text-foreground">{codDialogOrder?.total_xcg?.toFixed(2)} XCG</span></p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Cash Collected (XCG)</label>
              <Input
                type="number"
                step="0.01"
                value={codAmount}
                onChange={(e) => setCodAmount(e.target.value)}
                placeholder="Enter amount collected"
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the actual cash amount received from customer
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCodDialogOrder(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDelivery} disabled={markDeliveredMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
