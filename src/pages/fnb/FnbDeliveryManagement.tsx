import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Truck, Package, User, MapPin, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export default function FnbDeliveryManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>("");

  // Fetch ready orders
  const { data: readyOrders, isLoading: loadingReady } = useQuery({
    queryKey: ["fnb-orders-ready"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fnb_orders")
        .select(`
          *,
          fnb_customers (name, address, whatsapp_phone),
          fnb_order_items (id, quantity, product_id, fnb_products (name))
        `)
        .eq("status", "ready")
        .order("delivery_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch out for delivery orders
  const { data: outForDeliveryOrders, isLoading: loadingOut } = useQuery({
    queryKey: ["fnb-orders-out-for-delivery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fnb_orders")
        .select(`
          *,
          fnb_customers (name, address, whatsapp_phone),
          fnb_order_items (id, quantity, product_id, fnb_products (name))
        `)
        .eq("status", "out_for_delivery")
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch drivers (users with driver role)
  const { data: drivers } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles!inner(id, full_name, email)")
        .eq("role", "driver");
      if (error) throw error;
      return data;
    },
  });

  // Assign driver mutation
  const assignDriverMutation = useMutation({
    mutationFn: async ({ orderIds, driverId, driverName }: { orderIds: string[]; driverId: string; driverName: string }) => {
      const { error } = await supabase
        .from("fnb_orders")
        .update({
          driver_id: driverId,
          driver_name: driverName,
          status: "out_for_delivery",
          assigned_at: new Date().toISOString(),
        })
        .in("id", orderIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Driver assigned successfully");
      queryClient.invalidateQueries({ queryKey: ["fnb-orders-ready"] });
      queryClient.invalidateQueries({ queryKey: ["fnb-orders-out-for-delivery"] });
      setSelectedOrders([]);
      setSelectedDriver("");
    },
    onError: (error) => {
      toast.error("Failed to assign driver: " + error.message);
    },
  });

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderId));
    }
  };

  const handleAssignDriver = () => {
    if (!selectedDriver || selectedOrders.length === 0) {
      toast.error("Please select a driver and at least one order");
      return;
    }
    const driver = drivers?.find((d) => d.user_id === selectedDriver);
    const driverName = driver?.profiles?.full_name || driver?.profiles?.email || "Unknown Driver";
    assignDriverMutation.mutate({
      orderIds: selectedOrders,
      driverId: selectedDriver,
      driverName,
    });
  };

  const groupOrdersByDate = (orders: any[]) => {
    const grouped: Record<string, any[]> = {};
    orders?.forEach((order) => {
      const date = order.delivery_date || "No Date";
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(order);
    });
    return grouped;
  };

  const renderOrderCard = (order: any, showCheckbox: boolean = false) => (
    <Card key={order.id} className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {showCheckbox && (
            <Checkbox
              checked={selectedOrders.includes(order.id)}
              onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
              className="mt-1"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{order.order_number}</div>
              <Badge variant="outline">{order.fnb_order_items?.length || 0} items</Badge>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {order.fnb_customers?.name || "Unknown Customer"}
              </div>
              {order.fnb_customers?.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {order.fnb_customers.address}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                {order.total_xcg?.toFixed(2)} XCG
              </div>
              {order.driver_name && (
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  {order.driver_name}
                </div>
              )}
              {order.assigned_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Assigned: {format(new Date(order.assigned_at), "HH:mm")}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/fnb")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">F&B Delivery Management</h1>
          <p className="text-muted-foreground">Assign drivers to ready orders</p>
        </div>
      </div>

      <Tabs defaultValue="ready" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ready">
            Ready for Delivery ({readyOrders?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="out">
            Out for Delivery ({outForDeliveryOrders?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ready" className="space-y-4">
          {/* Driver Assignment Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Assign Driver</label>
                  <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers?.map((driver) => (
                        <SelectItem key={driver.user_id} value={driver.user_id}>
                          {driver.profiles?.full_name || driver.profiles?.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAssignDriver}
                  disabled={!selectedDriver || selectedOrders.length === 0 || assignDriverMutation.isPending}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Assign to {selectedOrders.length} order(s)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Orders grouped by date */}
          {loadingReady ? (
            <p className="text-center py-8 text-muted-foreground">Loading orders...</p>
          ) : readyOrders?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No orders ready for delivery</p>
          ) : (
            Object.entries(groupOrdersByDate(readyOrders || [])).map(([date, orders]) => (
              <Card key={date}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{date === "No Date" ? "No Delivery Date" : format(new Date(date), "EEEE, MMM d")}</span>
                    <Badge>{orders.length} orders</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {orders.map((order) => renderOrderCard(order, true))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="out" className="space-y-4">
          {loadingOut ? (
            <p className="text-center py-8 text-muted-foreground">Loading orders...</p>
          ) : outForDeliveryOrders?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No orders out for delivery</p>
          ) : (
            Object.entries(groupOrdersByDate(outForDeliveryOrders || [])).map(([date, orders]) => (
              <Card key={date}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{date === "No Date" ? "No Delivery Date" : format(new Date(date), "EEEE, MMM d")}</span>
                    <Badge>{orders.length} orders</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {orders.map((order) => renderOrderCard(order))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
