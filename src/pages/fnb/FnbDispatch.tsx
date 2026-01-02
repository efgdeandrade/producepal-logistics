import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Truck, MapPin, Clock, Package, Zap, Send, RefreshCw, 
  AlertTriangle, ChevronRight, Route, Users, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface RouteAssignment {
  driver_id: string;
  driver_name: string;
  stops: {
    order_id: string;
    order_number: string;
    customer_name: string;
    address: string;
    latitude: number;
    longitude: number;
    priority: number;
    sequence: number;
    estimated_arrival: string;
  }[];
  total_stops: number;
  estimated_duration_minutes: number;
  total_distance_km: number;
}

interface ReadyOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_address: string;
  latitude: number | null;
  longitude: number | null;
  delivery_zone: string | null;
  priority: number;
  total_xcg: number;
}

const DRIVER_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

const FnbDispatch = () => {
  const queryClient = useQueryClient();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [assignments, setAssignments] = useState<RouteAssignment[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  // Fetch ready orders
  const { data: readyOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["dispatch-ready-orders", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fnb_orders")
        .select(`
          id,
          order_number,
          total_xcg,
          priority,
          fnb_customers!inner(name, address, latitude, longitude, delivery_zone)
        `)
        .eq("status", "ready")
        .eq("delivery_date", selectedDate);
      
      if (error) throw error;
      
      return data?.map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.fnb_customers.name,
        customer_address: o.fnb_customers.address,
        latitude: o.fnb_customers.latitude,
        longitude: o.fnb_customers.longitude,
        delivery_zone: o.fnb_customers.delivery_zone,
        priority: o.priority || 0,
        total_xcg: o.total_xcg || 0
      })) as ReadyOrder[];
    }
  });

  // Fetch available drivers for the date
  const { data: availableDrivers = [] } = useQuery({
    queryKey: ["dispatch-drivers", selectedDate],
    queryFn: async () => {
      const { data: avail } = await supabase
        .from("driver_availability")
        .select(`
          driver_id,
          vehicle_capacity,
          profiles!inner(id, email, full_name)
        `)
        .eq("date", selectedDate)
        .eq("is_available", true);
      
      if (avail && avail.length > 0) {
        return avail.map((a: any) => ({
          id: a.driver_id,
          name: a.profiles.full_name || a.profiles.email,
          capacity: a.vehicle_capacity
        }));
      }
      
      // Fall back to all drivers if no availability set
      const { data: allDrivers } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          profiles!inner(id, email, full_name)
        `)
        .eq("role", "driver");
      
      return allDrivers?.map((d: any) => ({
        id: d.user_id,
        name: d.profiles.full_name || d.profiles.email,
        capacity: 50
      })) || [];
    }
  });

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      if (!mapContainer.current || map.current) return;

      const { data } = await supabase.functions.invoke("get-mapbox-token");
      if (!data?.token) return;

      mapboxgl.accessToken = data.token;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-68.9900, 12.1696], // Curacao center
        zoom: 11
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    };

    initMap();

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update map markers when assignments change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Clear existing route lines
    if (map.current.getSource("routes")) {
      map.current.removeLayer("routes-line");
      map.current.removeSource("routes");
    }

    if (assignments.length === 0) {
      // Show unassigned orders
      readyOrders.forEach(order => {
        if (order.latitude && order.longitude) {
          const el = document.createElement("div");
          el.className = "w-6 h-6 rounded-full bg-muted-foreground border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold";
          el.innerHTML = order.priority === 2 ? "!" : order.priority === 1 ? "•" : "";
          
          const marker = new mapboxgl.Marker(el)
            .setLngLat([order.longitude, order.latitude])
            .setPopup(new mapboxgl.Popup().setHTML(`
              <strong>${order.customer_name}</strong><br/>
              ${order.order_number}<br/>
              ${order.customer_address || "No address"}
            `))
            .addTo(map.current!);
          
          markersRef.current.push(marker);
        }
      });
      return;
    }

    // Show assigned routes
    const routeFeatures: any[] = [];

    assignments.forEach((assignment, driverIdx) => {
      const color = DRIVER_COLORS[driverIdx % DRIVER_COLORS.length];
      const isSelected = selectedDriver === null || selectedDriver === assignment.driver_id;
      
      const coordinates: [number, number][] = [];

      assignment.stops.forEach((stop, stopIdx) => {
        coordinates.push([stop.longitude, stop.latitude]);

        const el = document.createElement("div");
        el.className = cn(
          "w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold transition-opacity",
          !isSelected && "opacity-30"
        );
        el.style.backgroundColor = color;
        el.textContent = String(stopIdx + 1);
        
        if (stop.priority === 2) {
          el.classList.add("animate-pulse");
          el.style.boxShadow = "0 0 10px red";
        }
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat([stop.longitude, stop.latitude])
          .setPopup(new mapboxgl.Popup().setHTML(`
            <strong>${stop.customer_name}</strong><br/>
            Order: ${stop.order_number}<br/>
            Stop #${stop.sequence}<br/>
            ETA: ${format(new Date(stop.estimated_arrival), "h:mm a")}
          `))
          .addTo(map.current!);
        
        markersRef.current.push(marker);
      });

      if (coordinates.length > 1) {
        routeFeatures.push({
          type: "Feature",
          properties: { color, opacity: isSelected ? 0.8 : 0.2 },
          geometry: { type: "LineString", coordinates }
        });
      }
    });

    // Add route lines
    if (routeFeatures.length > 0 && map.current) {
      map.current.addSource("routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: routeFeatures }
      });

      map.current.addLayer({
        id: "routes-line",
        type: "line",
        source: "routes",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-opacity": ["get", "opacity"]
        }
      });
    }
  }, [assignments, readyOrders, selectedDriver]);

  const runOptimization = async () => {
    setIsOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("optimize-routes", {
        body: { date: selectedDate }
      });

      if (error) throw error;
      
      if (data.success) {
        setAssignments(data.assignments || []);
        setAiSuggestions(data.ai_suggestions || []);
        toast.success(`Created ${data.assignments?.length || 0} optimized routes`);
      } else {
        toast.error(data.error || "Optimization failed");
      }
    } catch (err) {
      console.error("Optimization error:", err);
      toast.error("Failed to optimize routes");
    } finally {
      setIsOptimizing(false);
    }
  };

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      const updates = assignments.flatMap(assignment => 
        assignment.stops.map(stop => ({
          order_id: stop.order_id,
          driver_id: assignment.driver_id,
          driver_name: assignment.driver_name,
          sequence: stop.sequence
        }))
      );

      for (const update of updates) {
        const { error } = await supabase
          .from("fnb_orders")
          .update({
            status: "out_for_delivery",
            driver_id: update.driver_id,
            driver_name: update.driver_name,
            assigned_at: new Date().toISOString()
          })
          .eq("id", update.order_id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch-ready-orders"] });
      toast.success("All routes dispatched to drivers!");
      setAssignments([]);
    },
    onError: (error) => {
      toast.error("Failed to dispatch: " + error.message);
    }
  });

  const totalStops = assignments.reduce((sum, a) => sum + a.total_stops, 0);
  const totalDuration = assignments.reduce((sum, a) => sum + a.estimated_duration_minutes, 0);
  const totalDistance = assignments.reduce((sum, a) => sum + a.total_distance_km, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="h-[calc(100vh-4rem)] flex">
        {/* Left Panel - Orders Pool */}
        <div className="w-80 border-r flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Orders Pool
              </h2>
              <Badge variant="secondary">{readyOrders.length}</Badge>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {ordersLoading ? (
                <p className="text-center text-muted-foreground py-4">Loading...</p>
              ) : readyOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No ready orders</p>
              ) : (
                readyOrders.map(order => (
                  <Card key={order.id} className={cn(
                    "cursor-pointer hover:shadow-md transition-shadow",
                    order.priority === 2 && "border-red-500 bg-red-500/5",
                    order.priority === 1 && "border-orange-500 bg-orange-500/5"
                  )}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{order.customer_name}</span>
                            {order.priority === 2 && (
                              <Badge variant="destructive" className="text-[10px] px-1">CRITICAL</Badge>
                            )}
                            {order.priority === 1 && (
                              <Badge className="bg-orange-500 text-[10px] px-1">URGENT</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{order.order_number}</p>
                          <p className="text-xs text-muted-foreground truncate">{order.customer_address}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {order.delivery_zone || "No zone"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Users className="h-4 w-4" />
              <span>{availableDrivers.length} drivers available</span>
            </div>
            <Button 
              className="w-full" 
              onClick={runOptimization}
              disabled={isOptimizing || readyOrders.length === 0}
            >
              {isOptimizing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Auto-Optimize Routes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Center - Map */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0" />
          
          {/* AI Suggestions Overlay */}
          {aiSuggestions.length > 0 && (
            <div className="absolute top-4 left-4 right-4 max-w-md">
              <Card className="bg-background/95 backdrop-blur">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    AI Suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 px-3">
                  <ul className="text-xs space-y-1">
                    {aiSuggestions.map((suggestion, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <ChevronRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Stats Overlay */}
          {assignments.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 flex justify-center">
              <Card className="bg-background/95 backdrop-blur">
                <CardContent className="py-2 px-4 flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{totalStops}</span>
                    <span className="text-muted-foreground">stops</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{Math.round(totalDuration / 60)}h {totalDuration % 60}m</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{totalDistance.toFixed(1)} km</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right Panel - Route Assignments */}
        <div className="w-80 border-l flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Route className="h-4 w-4" />
              Route Assignments
            </h2>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-3">
              {assignments.length === 0 ? (
                <div className="text-center py-8">
                  <Truck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Click "Auto-Optimize" to create routes
                  </p>
                </div>
              ) : (
                assignments.map((assignment, idx) => (
                  <Card 
                    key={assignment.driver_id}
                    className={cn(
                      "cursor-pointer transition-all",
                      selectedDriver === assignment.driver_id && "ring-2 ring-primary"
                    )}
                    onClick={() => setSelectedDriver(
                      selectedDriver === assignment.driver_id ? null : assignment.driver_id
                    )}
                  >
                    <CardHeader className="py-2 px-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: DRIVER_COLORS[idx % DRIVER_COLORS.length] }}
                          />
                          <CardTitle className="text-sm">{assignment.driver_name}</CardTitle>
                        </div>
                        <Badge variant="outline">{assignment.total_stops} stops</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2 px-3">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {assignment.estimated_duration_minutes}m
                        </span>
                        <span className="flex items-center gap-1">
                          <Route className="h-3 w-3" />
                          {assignment.total_distance_km}km
                        </span>
                      </div>
                      <div className="space-y-1">
                        {assignment.stops.slice(0, 3).map(stop => (
                          <div key={stop.order_id} className="flex items-center gap-2 text-xs">
                            <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                              {stop.sequence}
                            </span>
                            <span className="truncate flex-1">{stop.customer_name}</span>
                            {stop.priority === 2 && <AlertTriangle className="h-3 w-3 text-red-500" />}
                          </div>
                        ))}
                        {assignment.stops.length > 3 && (
                          <p className="text-xs text-muted-foreground pl-6">
                            +{assignment.stops.length - 3} more stops
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
          
          {assignments.length > 0 && (
            <div className="p-4 border-t bg-muted/50">
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => dispatchMutation.mutate()}
                disabled={dispatchMutation.isPending}
              >
                {dispatchMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Dispatching...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Dispatch All Routes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FnbDispatch;
