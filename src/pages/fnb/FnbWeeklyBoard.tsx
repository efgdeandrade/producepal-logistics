import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
  AlertCircle
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

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
  fnb_customers: {
    name: string;
    delivery_zone: string | null;
    customer_type: CustomerType;
  } | null;
  fnb_order_items: { id: string }[];
}

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
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)); // Mon-Sat

  // Fetch orders for the week
  const { data: orders, isLoading } = useQuery({
    queryKey: ["fnb-weekly-orders", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 6);
      const { data, error } = await supabase
        .from("fnb_orders")
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
          fnb_customers (name, delivery_zone, customer_type),
          fnb_order_items (id)
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
      return isSameDay(parseISO(order.delivery_date), day);
    }) || [];
  };

  const getZoneColor = (zone: string | null) => {
    return zone ? (zoneColors[zone] || zoneColors.default) : zoneColors.default;
  };

  const getDayStats = (dayOrders: OrderWithDetails[]) => {
    const total = dayOrders.length;
    const delivered = dayOrders.filter((o) => o.status === "delivered").length;
    const pendingReceipts = dayOrders.filter(
      (o) => o.fnb_customers?.customer_type === "supermarket" && o.status === "delivered" && !o.receipt_verified_at
    ).length;
    const codTotal = dayOrders
      .filter((o) => o.fnb_customers?.customer_type === "cod" || o.payment_method === "cod")
      .reduce((sum, o) => sum + (o.total_xcg || 0), 0);
    
    return { total, delivered, pendingReceipts, codTotal };
  };

  const previousWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const renderOrderCard = (order: OrderWithDetails) => {
    const customerType = order.fnb_customers?.customer_type || "regular";
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
          getZoneColor(order.fnb_customers?.delivery_zone || null),
          needsReceipt && "ring-2 ring-orange-400"
        )}
        onClick={() => navigate(`/fnb/orders`)}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{order.fnb_customers?.name || "Unknown"}</p>
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fnb">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {weekDays.map((day) => {
              const dayOrders = getOrdersForDay(day);
              const stats = getDayStats(dayOrders);
              const isToday = isSameDay(day, new Date());

              return (
                <Card
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[400px]",
                    isToday && "ring-2 ring-primary"
                  )}
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
                  <CardContent className="space-y-2 overflow-y-auto max-h-[320px]">
                    {dayOrders.length === 0 ? (
                      <p className="text-center py-4 text-muted-foreground text-sm">
                        No orders
                      </p>
                    ) : (
                      dayOrders.map(renderOrderCard)
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
