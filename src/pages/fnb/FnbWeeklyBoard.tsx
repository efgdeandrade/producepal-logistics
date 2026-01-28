import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFnbStandingOrdersSync } from "@/hooks/useFnbStandingOrdersSync";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Package, 
  Store, 
  Banknote, 
  CreditCard,
  CheckCircle,
  Clock,
  Truck,
  Camera,
  AlertCircle,
  ExternalLink,
  Wand2,
  Loader2,
  CalendarCheck,
  Repeat
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format, addDays, parseISO } from "date-fns";
import { startOfWeekCuracao, isSameDayCuracao, todayCuracao } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { useFnbStandingOrders } from "@/hooks/useFnbStandingOrders";

// Cast the backend client to `any` in this page to avoid excessively-deep type instantiation errors
// from complex nested selects (keeps runtime behavior the same).
const supabase = supabaseClient as any;

type CustomerType = "regular" | "supermarket" | "cod" | "credit";

interface OrderWithDetails {
  id: string;
  order_number: string;
  status: string;
  total_xcg: number | null;
  delivery_date: string | null;
  driver_name: string | null;
  payment_method: string | null;
  receipt_photo_url: string | null;
  receipt_verified_at: string | null;
  quickbooks_invoice_id: string | null;
  notes: string | null;
  distribution_customers: {
    name: string;
    delivery_zone: string | null;
    customer_type: CustomerType;
  } | null;
  distribution_order_items: { id: string }[];
}

const isStandingOrder = (order: OrderWithDetails) => {
  return order.notes?.startsWith('Auto-generated from standing order:') ?? false;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  ready: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  out_for_delivery: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-destructive/10 text-destructive",
};

const zoneColors: Record<string, string> = {
  "Willemstad": "border-l-blue-500",
  "Otrobanda": "border-l-green-500",
  "Punda": "border-l-purple-500",
  "Pietermaai": "border-l-orange-500",
  "Scharloo": "border-l-pink-500",
  "Salinja": "border-l-teal-500",
  "default": "border-l-muted-foreground",
};

const customerTypeIcons: Record<CustomerType, React.ReactNode> = {
  regular: <Package className="h-3 w-3" />,
  supermarket: <Store className="h-3 w-3" />,
  cod: <Banknote className="h-3 w-3" />,
  credit: <CreditCard className="h-3 w-3" />,
};

const customerTypeLabels: Record<CustomerType, string> = {
  regular: "Regular",
  supermarket: "Supermarket",
  cod: "COD",
  credit: "Credit",
};

export default function FnbWeeklyBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeekCuracao());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { templates, generateOrdersForWeek, getWeekGeneration } = useFnbStandingOrders();
  const { generateForDateRange } = useFnbStandingOrdersSync();

  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)); // Mon-Sat

  // Check if this week has been generated
  const { data: weekGeneration, refetch: refetchGeneration } = useQuery({
    queryKey: ["fnb-week-generation", format(weekStart, "yyyy-MM-dd")],
    queryFn: () => getWeekGeneration(weekStart),
  });

  const activeTemplatesCount = templates.filter(t => t.is_active && t.items.length > 0).length;

  // Auto-generate standing orders for the visible week
  useEffect(() => {
    const syncStandingOrders = async () => {
      const weekEnd = addDays(weekStart, 6);
      const ordersCreated = await generateForDateRange(weekStart, weekEnd);
      if (ordersCreated > 0) {
        // Refetch orders if new ones were created
        queryClient.invalidateQueries({ queryKey: ["fnb-weekly-orders"] });
        refetchGeneration();
      }
    };
    syncStandingOrders();
  }, [weekStart, generateForDateRange, queryClient, refetchGeneration]);

  // Fetch orders for the week
  const { data: orders, isLoading } = useQuery({
    queryKey: ["fnb-weekly-orders", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 6);
      const { data, error } = await supabase
        .from("distribution_orders")
        .select(`
          id,
          order_number,
          status,
          total_xcg,
          delivery_date,
          driver_name,
          payment_method,
          receipt_photo_url,
          receipt_verified_at,
          quickbooks_invoice_id,
          notes,
          distribution_customers (name, delivery_zone, customer_type),
          distribution_order_items (id)
        `)
        .gte("delivery_date", format(weekStart, "yyyy-MM-dd"))
        .lte("delivery_date", format(weekEnd, "yyyy-MM-dd"))
        .neq("status", "cancelled")
        .order("delivery_date", { ascending: true });
      if (error) throw error;
      return data as OrderWithDetails[];
    },
  });

  const getOrdersForDay = (day: Date) => {
    return orders?.filter((order) => {
      if (!order.delivery_date) return false;
      return isSameDayCuracao(order.delivery_date, day);
    }) || [];
  };

  const getZoneColor = (zone: string | null) => {
    return zone ? (zoneColors[zone] || zoneColors.default) : zoneColors.default;
  };

  const getDayStats = (dayOrders: OrderWithDetails[]) => {
    const total = dayOrders.length;
    const delivered = dayOrders.filter((o) => o.status === "delivered").length;
    const pendingReceipts = dayOrders.filter(
      (o) => o.distribution_customers?.customer_type === "supermarket" && o.status === "delivered" && !o.receipt_verified_at
    ).length;
    const codTotal = dayOrders
      .filter((o) => o.distribution_customers?.customer_type === "cod" || o.payment_method === "cod")
      .reduce((sum, o) => sum + (o.total_xcg || 0), 0);
    
    return { total, delivered, pendingReceipts, codTotal };
  };

  const previousWeek = () => {
    setWeekStart(addDays(weekStart, -7));
  };
  const nextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };
  const goToToday = () => setWeekStart(startOfWeekCuracao());

  const handleGenerateWeek = async () => {
    setIsGenerating(true);
    try {
      const ordersCreated = await generateOrdersForWeek(weekStart);
      if (ordersCreated > 0) {
        // Refresh orders and generation status
        queryClient.invalidateQueries({ queryKey: ["fnb-weekly-orders"] });
        refetchGeneration();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const renderOrderCard = (order: OrderWithDetails, compact = false) => {
    const customerType = order.distribution_customers?.customer_type || "regular";
    const isSupermarket = customerType === "supermarket";
    const needsReceipt = isSupermarket && order.status === "delivered" && !order.receipt_verified_at;
    const hasReceipt = !!order.receipt_photo_url;
    const isVerified = !!order.receipt_verified_at;
    const hasQbInvoice = !!order.quickbooks_invoice_id;

    return (
      <Card
        key={order.id}
        className={cn(
          "mb-2 cursor-pointer hover:shadow-md transition-shadow border-l-4",
          getZoneColor(order.distribution_customers?.delivery_zone || null),
          needsReceipt && "ring-2 ring-orange-400"
        )}
        onClick={() => navigate(`/fnb/orders`)}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {isStandingOrder(order) && (
                  <Repeat className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                )}
                <p className="font-medium text-sm truncate">{order.distribution_customers?.name || "Unknown"}</p>
              </div>
              <p className="text-xs text-muted-foreground">{order.order_number}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge className={cn("text-xs", statusColors[order.status])}>
                {order.status.replace("_", " ")}
              </Badge>
              <div className="flex items-center gap-1">
                {customerTypeIcons[customerType]}
                <span className="text-xs text-muted-foreground">{customerTypeLabels[customerType]}</span>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="font-medium">{order.total_xcg?.toFixed(2)} XCG</span>
            <div className="flex items-center gap-1">
              {order.driver_name && (
                <Badge variant="outline" className="text-xs py-0">
                  <Truck className="h-3 w-3 mr-1" />
                  {order.driver_name.split(" ")[0]}
                </Badge>
              )}
            </div>
          </div>

          {/* Status indicators for supermarket orders */}
          {isSupermarket && order.status === "delivered" && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              {hasReceipt ? (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <Camera className="h-3 w-3 mr-1" />
                  Receipt
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No Receipt
                </Badge>
              )}
              {isVerified ? (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              )}
              {hasQbInvoice && (
                <Badge variant="outline" className="text-blue-600 border-blue-300">
                  QB
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Daily drill-down dialog content
  const selectedDayOrders = selectedDay ? getOrdersForDay(selectedDay) : [];
  const selectedDayStats = selectedDay ? getDayStats(selectedDayOrders) : null;
  
  // Group orders by driver
  const ordersByDriver = selectedDayOrders.reduce((acc, order) => {
    const driver = order.driver_name || "Unassigned";
    if (!acc[driver]) acc[driver] = [];
    acc[driver].push(order);
    return acc;
  }, {} as Record<string, OrderWithDetails[]>);

  return (
    <div className="px-4 md:container max-w-screen-2xl py-6 space-y-6 w-full overflow-x-hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/distribution">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Weekly Delivery Board</h1>
            <p className="text-muted-foreground">
              Plan and track deliveries across the week
            </p>
          </div>
        </div>

        {/* Week Navigation */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={previousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">
                  {format(weekStart, "MMM d")} - {format(addDays(weekStart, 5), "MMM d, yyyy")}
                </h2>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Today
                </Button>
              </div>
              <Button variant="outline" size="icon" onClick={nextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Generate Week from Standing Orders */}
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-medium">Standing Order Templates</h3>
                  <p className="text-sm text-muted-foreground">
                    {weekGeneration ? (
                      <>
                        Generated {weekGeneration.orders_created} orders on{" "}
                        {format(parseISO(weekGeneration.generated_at), "MMM d, h:mm a")}
                      </>
                    ) : activeTemplatesCount > 0 ? (
                      <>{activeTemplatesCount} active templates ready to generate</>
                    ) : (
                      <>No templates configured. <Link to="/distribution/standing-orders" className="text-primary underline">Set up templates</Link></>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/distribution/standing-orders">
                    Manage Templates
                  </Link>
                </Button>
                <Button
                  onClick={handleGenerateWeek}
                  disabled={isGenerating || !!weekGeneration || activeTemplatesCount === 0}
                  size="sm"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  {weekGeneration ? "Already Generated" : "Generate Week"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <span>Supermarket (receipt required)</span>
          </div>
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            <span>COD</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Credit</span>
          </div>
        </div>

        {/* Calendar Grid */}
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
            {weekDays.map((day) => {
              const dayOrders = getOrdersForDay(day);
              const stats = getDayStats(dayOrders);
              const isToday = isSameDayCuracao(day, todayCuracao());

              return (
                <Card
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[500px] cursor-pointer hover:shadow-lg transition-shadow",
                    isToday && "ring-2 ring-primary"
                  )}
                  onClick={() => setSelectedDay(day)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <div>
                        <span className={cn("font-bold", isToday && "text-primary")}>
                          {format(day, "EEE")}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {format(day, "MMM d")}
                        </span>
                      </div>
                      <Badge variant={stats.total > 0 ? "default" : "secondary"}>
                        {stats.total}
                      </Badge>
                    </CardTitle>
                    {/* Day Stats */}
                    {stats.total > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {stats.delivered > 0 && (
                          <Badge variant="outline" className="text-xs text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {stats.delivered}
                          </Badge>
                        )}
                        {stats.pendingReceipts > 0 && (
                          <Badge variant="outline" className="text-xs text-orange-600">
                            <Camera className="h-3 w-3 mr-1" />
                            {stats.pendingReceipts}
                          </Badge>
                        )}
                        {stats.codTotal > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Banknote className="h-3 w-3 mr-1" />
                            {stats.codTotal.toFixed(0)}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 overflow-y-auto max-h-[420px]">
                    {dayOrders.length === 0 ? (
                      <p className="text-center py-4 text-muted-foreground text-sm">
                        No orders
                      </p>
                    ) : (
                      dayOrders.map((order) => renderOrderCard(order))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Daily Drill-Down Dialog */}
        <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-4">
                <span>{selectedDay && format(selectedDay, "EEEE, MMMM d, yyyy")}</span>
                {selectedDayStats && (
                  <div className="flex gap-2">
                    <Badge>{selectedDayStats.total} orders</Badge>
                    {selectedDayStats.delivered > 0 && (
                      <Badge variant="outline" className="text-green-600">
                        {selectedDayStats.delivered} delivered
                      </Badge>
                    )}
                  </div>
                )}
              </DialogTitle>
            </DialogHeader>

            {selectedDayOrders.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No orders for this day</p>
            ) : (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{selectedDayStats?.total}</div>
                      <p className="text-xs text-muted-foreground">Total Orders</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-green-600">{selectedDayStats?.delivered}</div>
                      <p className="text-xs text-muted-foreground">Delivered</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-orange-600">{selectedDayStats?.pendingReceipts}</div>
                      <p className="text-xs text-muted-foreground">Pending Receipts</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{selectedDayStats?.codTotal.toFixed(2)}</div>
                      <p className="text-xs text-muted-foreground">COD Total (XCG)</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Orders by Driver */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Orders by Driver</h3>
                  {Object.entries(ordersByDriver).map(([driver, driverOrders]) => {
                    const driverTotal = driverOrders.reduce((sum, o) => sum + (o.total_xcg || 0), 0);
                    const driverCOD = driverOrders
                      .filter((o) => o.distribution_customers?.customer_type === "cod" || o.payment_method === "cod")
                      .reduce((sum, o) => sum + (o.total_xcg || 0), 0);

                    return (
                      <Card key={driver}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4" />
                              <span>{driver}</span>
                              <Badge variant="outline">{driverOrders.length} orders</Badge>
                            </div>
                            <div className="flex gap-2 text-xs">
                              <span>{driverTotal.toFixed(2)} XCG</span>
                              {driverCOD > 0 && (
                                <Badge variant="outline" className="text-orange-600">
                                  COD: {driverCOD.toFixed(2)}
                                </Badge>
                              )}
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-2 md:grid-cols-2">
                            {driverOrders.map((order) => renderOrderCard(order))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button asChild variant="outline">
                    <Link to="/distribution/receipts">
                      <Camera className="h-4 w-4 mr-2" />
                      Verify Receipts
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/distribution/cod">
                      <Banknote className="h-4 w-4 mr-2" />
                      COD Reconciliation
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/distribution/orders">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View All Orders
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
}
