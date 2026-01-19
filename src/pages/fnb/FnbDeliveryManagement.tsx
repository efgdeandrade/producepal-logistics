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
import { ArrowLeft, Truck, Package, User, MapPin, Clock, Route, UserPlus, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GroupBy = "date" | "zone";

export default function FnbDeliveryManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [groupBy, setGroupBy] = useState<GroupBy>("zone");

  // Add Driver Dialog state
  const [addDriverOpen, setAddDriverOpen] = useState(false);
  const [driverForm, setDriverForm] = useState({ fullName: "", email: "" });
  const [resetLink, setResetLink] = useState("");
  const [showResetLink, setShowResetLink] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch ready orders with customer zone info
  const { data: readyOrders, isLoading: loadingReady } = useQuery({
    queryKey: ["fnb-orders-ready"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_orders")
        .select(`
          *,
          distribution_customers (name, address, whatsapp_phone, delivery_zone),
          distribution_order_items (id, quantity, product_id, distribution_products (name))
        `)
        .eq("status", "ready")
        .neq("is_pickup", true)
        .order("delivery_date", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fetch out for delivery orders
  const { data: outForDeliveryOrders, isLoading: loadingOut } = useQuery({
    queryKey: ["fnb-orders-out-for-delivery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_orders")
        .select(`
          *,
          distribution_customers (name, address, whatsapp_phone, delivery_zone),
          distribution_order_items (id, quantity, product_id, distribution_products (name))
        `)
        .eq("status", "out_for_delivery")
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
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
        .from("distribution_orders")
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

  // Create driver mutation
  const createDriverMutation = useMutation({
    mutationFn: async ({ email, fullName }: { email: string; fullName: string }) => {
      const { data, error } = await supabase.functions.invoke("create-user-direct", {
        body: { email, fullName, role: "driver" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setResetLink(data.resetLink);
      setShowResetLink(true);
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Driver created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create driver: " + error.message);
    },
  });

  const handleCreateDriver = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const errors: Record<string, string> = {};
    if (!driverForm.fullName || driverForm.fullName.trim().length < 2) {
      errors.fullName = "Name must be at least 2 characters";
    }
    if (!driverForm.email || !driverForm.email.includes("@")) {
      errors.email = "Valid email is required";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    createDriverMutation.mutate({
      fullName: driverForm.fullName.trim(),
      email: driverForm.email.trim().toLowerCase(),
    });
  };

  const handleCloseDriverDialog = () => {
    setAddDriverOpen(false);
    setDriverForm({ fullName: "", email: "" });
    setResetLink("");
    setShowResetLink(false);
    setFormErrors({});
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(resetLink);
    toast.success("Reset link copied to clipboard!");
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderId));
    }
  };

  const handleSelectGroup = (orderIds: string[], checked: boolean) => {
    if (checked) {
      const newSelected = [...new Set([...selectedOrders, ...orderIds])];
      setSelectedOrders(newSelected);
    } else {
      setSelectedOrders(selectedOrders.filter((id) => !orderIds.includes(id)));
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

  const groupOrdersByZone = (orders: any[]) => {
    const grouped: Record<string, any[]> = {};
    orders?.forEach((order) => {
      const zone = order.distribution_customers?.delivery_zone || "Unassigned Zone";
      if (!grouped[zone]) grouped[zone] = [];
      grouped[zone].push(order);
    });
    // Sort zones alphabetically, with "Unassigned Zone" at the end
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === "Unassigned Zone") return 1;
      if (b === "Unassigned Zone") return -1;
      return a.localeCompare(b);
    });
    const sortedGrouped: Record<string, any[]> = {};
    sortedKeys.forEach((key) => {
      sortedGrouped[key] = grouped[key];
    });
    return sortedGrouped;
  };

  const groupOrders = (orders: any[]) => {
    return groupBy === "zone" ? groupOrdersByZone(orders) : groupOrdersByDate(orders);
  };

  const getGroupLabel = (key: string) => {
    if (groupBy === "date") {
      return key === "No Date" ? "No Delivery Date" : format(new Date(key), "EEEE, MMM d");
    }
    return key;
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
              <div className="flex gap-1">
                {order.distribution_customers?.delivery_zone && (
                  <Badge variant="secondary" className="text-xs">
                    <Route className="h-3 w-3 mr-1" />
                    {order.distribution_customers.delivery_zone}
                  </Badge>
                )}
                <Badge variant="outline">{order.distribution_order_items?.length || 0} items</Badge>
              </div>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {order.distribution_customers?.name || "Unknown Customer"}
              </div>
              {order.distribution_customers?.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {order.distribution_customers.address}
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

  // Get unique zones for summary
  const zoneSummary = readyOrders?.reduce((acc: Record<string, number>, order: any) => {
    const zone = order.distribution_customers?.delivery_zone || "Unassigned";
    acc[zone] = (acc[zone] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="px-4 md:container py-4 md:py-6 space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/distribution")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Delivery Management</h1>
          <p className="text-muted-foreground">Assign drivers to ready orders by zone</p>
        </div>
      </div>

      {/* Zone Summary */}
      {zoneSummary && Object.keys(zoneSummary).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Route className="h-5 w-5" />
              Delivery Zones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(zoneSummary).map(([zone, count]: [string, any]) => (
                <Badge key={zone} variant="outline" className="text-sm py-1 px-3">
                  {zone}: {count} orders
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <div className="flex gap-2">
                    <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                      <SelectTrigger className="flex-1">
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
                    {isAdmin() && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setAddDriverOpen(true)}
                        title="Add Driver"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Group By</label>
                  <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zone">Zone</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAssignDriver}
                  disabled={!selectedDriver || selectedOrders.length === 0 || assignDriverMutation.isPending}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Assign {selectedOrders.length} order(s)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Orders grouped */}
          {loadingReady ? (
            <p className="text-center py-8 text-muted-foreground">Loading orders...</p>
          ) : readyOrders?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No orders ready for delivery</p>
          ) : (
            Object.entries(groupOrders(readyOrders || [])).map(([key, orders]) => {
              const groupOrderIds = orders.map((o: any) => o.id);
              const allSelected = groupOrderIds.every((id: string) => selectedOrders.includes(id));
              const someSelected = groupOrderIds.some((id: string) => selectedOrders.includes(id));
              
              return (
                <Card key={key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={(checked) => handleSelectGroup(groupOrderIds, checked === true)}
                        />
                        <span className="flex items-center gap-2">
                          {groupBy === "zone" && <Route className="h-4 w-4" />}
                          {getGroupLabel(key)}
                        </span>
                      </div>
                      <Badge>{orders.length} orders</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {orders.map((order: any) => renderOrderCard(order, true))}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="out" className="space-y-4">
          {loadingOut ? (
            <p className="text-center py-8 text-muted-foreground">Loading orders...</p>
          ) : outForDeliveryOrders?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No orders out for delivery</p>
          ) : (
            Object.entries(groupOrders(outForDeliveryOrders || [])).map(([key, orders]) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {groupBy === "zone" && <Route className="h-4 w-4" />}
                      {getGroupLabel(key)}
                    </span>
                    <Badge>{orders.length} orders</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {orders.map((order: any) => renderOrderCard(order))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Add Driver Dialog */}
      <Dialog open={addDriverOpen} onOpenChange={handleCloseDriverDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Driver</DialogTitle>
            <DialogDescription>
              Create a new driver account. They will receive a password reset link.
            </DialogDescription>
          </DialogHeader>
          
          {showResetLink ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                  Driver created successfully!
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Share this link with the driver to set their password:
                </p>
                <div className="flex gap-2">
                  <Input value={resetLink} readOnly className="text-xs" />
                  <Button size="icon" variant="outline" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseDriverDialog}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateDriver} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={driverForm.fullName}
                  onChange={(e) => setDriverForm({ ...driverForm, fullName: e.target.value })}
                  placeholder="John Doe"
                />
                {formErrors.fullName && (
                  <p className="text-xs text-destructive">{formErrors.fullName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={driverForm.email}
                  onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
                  placeholder="driver@example.com"
                />
                {formErrors.email && (
                  <p className="text-xs text-destructive">{formErrors.email}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDriverDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createDriverMutation.isPending}>
                  {createDriverMutation.isPending ? "Creating..." : "Create Driver"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}