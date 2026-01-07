import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Navigation, 
  Phone, 
  MessageCircle, 
  CheckCircle, 
  MapPin, 
  Truck, 
  Clock, 
  Banknote,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronUp,
  ChevronDown,
  Camera,
  X
} from "lucide-react";
import { format } from "date-fns";
import DriverMap from "@/components/driver/DriverMap";
import DeliveryCard from "@/components/driver/DeliveryCard";
import NavigationButton from "@/components/driver/NavigationButton";
import CODDialog from "@/components/driver/CODDialog";
import DriverMobileWallet from "@/components/fnb/DriverMobileWallet";
import { useRecordCODCollection } from "@/hooks/useDriverWallet";

type PaymentMethodType = "cash" | "swipe" | "transfer" | "credit";

interface DeliveryOrder {
  id: string;
  order_number: string;
  total_xcg: number | null;
  notes: string | null;
  status: string | null;
  delivery_date: string | null;
  fnb_customers: {
    name: string;
    address: string | null;
    whatsapp_phone: string;
    customer_type: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  fnb_order_items: Array<{
    id: string;
    quantity: number;
    picked_quantity: number | null;
    short_quantity: number | null;
    fnb_products: { name: string } | null;
  }>;
}

export default function FnbDriverMobile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [codDialogOrder, setCodDialogOrder] = useState<DeliveryOrder | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // GPS tracking
  useEffect(() => {
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('GPS error:', error);
          toast.error('GPS access required for navigation');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Fetch orders assigned to driver
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["driver-mobile-orders", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("fnb_orders")
        .select(`
          *,
          fnb_customers (name, address, whatsapp_phone, customer_type, latitude, longitude),
          fnb_order_items (id, quantity, picked_quantity, short_quantity, product_id, fnb_products (name))
        `)
        .eq("driver_id", user.id)
        .in("status", ["out_for_delivery"])
        .order("delivery_date", { ascending: true });
      if (error) throw error;
      return data as DeliveryOrder[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch completed orders today
  const { data: completedOrders = [] } = useQuery({
    queryKey: ["driver-completed-today", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("fnb_orders")
        .select("id, order_number, total_xcg, cod_amount_collected, delivered_at, fnb_customers(name)")
        .eq("driver_id", user.id)
        .eq("status", "delivered")
        .gte("delivered_at", today)
        .order("delivered_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Wallet mutation for recording COD collections
  const recordCollectionMutation = useRecordCODCollection();

  // Mark delivered mutation
  const markDeliveredMutation = useMutation({
    mutationFn: async ({ 
      orderId, 
      codCollected, 
      paymentMethod,
      receiptPhotoPath 
    }: { 
      orderId: string; 
      codCollected: number;
      paymentMethod: PaymentMethodType;
      receiptPhotoPath?: string;
    }) => {
      const { error } = await supabase
        .from("fnb_orders")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
          cod_amount_collected: codCollected,
          cod_collected_at: new Date().toISOString(),
          payment_method_used: paymentMethod,
          receipt_photo_url: receiptPhotoPath || null,
        })
        .eq("id", orderId);
      if (error) throw error;

      // Record to driver wallet if COD collected > 0
      if (codCollected > 0 && user?.id) {
        await recordCollectionMutation.mutateAsync({
          driverId: user.id,
          orderId,
          amount: codCollected,
          paymentMethod,
        });
      }
    },
    onSuccess: () => {
      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
      toast.success("Delivery completed!");
      queryClient.invalidateQueries({ queryKey: ["driver-mobile-orders"] });
      queryClient.invalidateQueries({ queryKey: ["driver-completed-today"] });
      setCodDialogOrder(null);
      setSelectedOrder(null);
    },
    onError: (error) => {
      toast.error("Failed: " + error.message);
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const todayCodTotal = completedOrders.reduce((sum, order) => sum + (order.cod_amount_collected || 0), 0);

  const currentTime = format(new Date(), "HH:mm");

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header - Compact for mobile */}
      <header className="flex-shrink-0 bg-card border-b px-4 py-3 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Driver Portal</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{currentTime}</span>
                {isOnline ? (
                  <Wifi className="h-3 w-3 text-success" />
                ) : (
                  <WifiOff className="h-3 w-3 text-destructive" />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 mt-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {orders.length} stops
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-success border-success/30">
            <CheckCircle className="h-3 w-3" />
            {completedOrders.length} done
          </Badge>
          {todayCodTotal > 0 && (
            <Badge variant="outline" className="flex items-center gap-1 text-primary border-primary/30">
              <Banknote className="h-3 w-3" />
              {todayCodTotal.toFixed(0)} XCG
            </Badge>
          )}
        </div>
      </header>

      {/* Wallet Card */}
      <div className="flex-shrink-0 px-4 py-2">
        <DriverMobileWallet />
      </div>

      {/* Map Section - Collapsible */}
      <div className={`flex-shrink-0 transition-all duration-300 ${showMap ? 'h-[35vh]' : 'h-0'}`}>
        {showMap && (
          <DriverMap
            orders={orders}
            driverLocation={driverLocation}
            selectedOrder={selectedOrder}
            onSelectOrder={setSelectedOrder}
          />
        )}
      </div>

      {/* Toggle map button */}
      <button
        onClick={() => setShowMap(!showMap)}
        className="flex-shrink-0 w-full py-2 bg-muted/50 border-y flex items-center justify-center gap-1 text-sm text-muted-foreground active:bg-muted"
      >
        {showMap ? (
          <>
            <ChevronUp className="h-4 w-4" />
            Hide Map
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            Show Map
          </>
        )}
      </button>

      {/* Delivery list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-safe">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle className="h-16 w-16 text-success mb-4" />
            <h2 className="text-xl font-semibold">All Done!</h2>
            <p className="text-muted-foreground mt-1">No pending deliveries</p>
            {todayCodTotal > 0 && (
              <div className="mt-4 p-4 bg-success/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Today's COD Collected</p>
                <p className="text-2xl font-bold text-success">{todayCodTotal.toFixed(2)} XCG</p>
              </div>
            )}
          </div>
        ) : (
          orders.map((order, index) => (
            <DeliveryCard
              key={order.id}
              order={order}
              index={index}
              isSelected={selectedOrder === order.id}
              onSelect={() => setSelectedOrder(order.id === selectedOrder ? null : order.id)}
              onNavigate={(address) => {
                const coords = order.fnb_customers?.latitude && order.fnb_customers?.longitude
                  ? { lat: order.fnb_customers.latitude, lng: order.fnb_customers.longitude }
                  : null;
                
                // Try to open maps app
                if (coords) {
                  window.open(`https://maps.apple.com/?daddr=${coords.lat},${coords.lng}`, '_blank');
                } else if (address) {
                  window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(address)}`, '_blank');
                }
              }}
              onCall={(phone) => window.open(`tel:${phone}`, '_self')}
              onWhatsApp={(phone) => window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank')}
              onDeliver={() => setCodDialogOrder(order)}
            />
          ))
        )}

        {/* Completed today section */}
        {completedOrders.length > 0 && orders.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Completed Today ({completedOrders.length})
            </h3>
            <div className="space-y-2">
              {completedOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{order.fnb_customers?.name}</p>
                    <p className="text-xs text-muted-foreground">{order.order_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {order.delivered_at && format(new Date(order.delivered_at), "HH:mm")}
                    </p>
                    {order.cod_amount_collected && order.cod_amount_collected > 0 && (
                      <p className="text-sm font-medium text-success">{order.cod_amount_collected.toFixed(0)} XCG</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* COD Dialog */}
      <CODDialog
        order={codDialogOrder}
        onClose={() => setCodDialogOrder(null)}
        onConfirm={(codCollected, paymentMethod, receiptPath) => {
          if (codDialogOrder) {
            markDeliveredMutation.mutate({
              orderId: codDialogOrder.id,
              codCollected,
              paymentMethod,
              receiptPhotoPath: receiptPath,
            });
          }
        }}
        isLoading={markDeliveredMutation.isPending}
      />
    </div>
  );
}
