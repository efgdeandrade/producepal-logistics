import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMapboxToken } from "@/hooks/useMapboxToken";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Truck, MapPin, Clock, Package, Zap, Send, RefreshCw, 
  AlertTriangle, ChevronRight, Route, Users, Lock, Unlock, GripVertical
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
    is_locked?: boolean;
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
  assignment_locked: boolean;
  driver_id: string | null;
}

const DRIVER_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", 
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"
];

// Helper to escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const FnbDispatch = () => {
  const queryClient = useQueryClient();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const { token: mapToken } = useMapboxToken();
  
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
        .from("distribution_orders")
        .select(`
          id, order_number, total_xcg, priority, assignment_locked, driver_id,
          distribution_customers!inner(name, address, latitude, longitude, delivery_zone)
        `)
        .eq("status", "ready")
        .eq("delivery_date", selectedDate);
      
      if (error) throw error;
      
      return (data || []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.distribution_customers.name,
        customer_address: o.distribution_customers.address,
        latitude: o.distribution_customers.latitude,
        longitude: o.distribution_customers.longitude,
        delivery_zone: o.distribution_customers.delivery_zone,
        priority: o.priority || 0,
        total_xcg: o.total_xcg || 0,
        assignment_locked: o.assignment_locked || false,
        driver_id: o.driver_id,
      })) as ReadyOrder[];
    }
  });

  // Fetch available drivers
  const { data: availableDrivers = [] } = useQuery({
    queryKey: ["dispatch-drivers", selectedDate],
    queryFn: async () => {
      const { data: avail } = await supabase
        .from("driver_availability")
        .select(`driver_id, vehicle_capacity, profiles!inner(id, email, full_name)`)
        .eq("date", selectedDate)
        .eq("is_available", true);
      
      if (avail?.length) {
        return avail.map((a: any) => ({
          id: a.driver_id,
          name: a.profiles.full_name || a.profiles.email,
          capacity: a.vehicle_capacity
        }));
      }
      
      const { data: allDrivers } = await supabase
        .from("user_roles")
        .select(`user_id, profiles!inner(id, email, full_name)`)
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
    if (!mapContainer.current || map.current || !mapToken) return;

    mapboxgl.accessToken = mapToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-68.9900, 12.1696],
      zoom: 11
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => { map.current?.remove(); map.current = null; };
  }, [mapToken]);

  // Update map markers
  useEffect(() => {
    if (!map.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (map.current.getSource("routes")) {
      map.current.removeLayer("routes-line");
      map.current.removeSource("routes");
    }

    if (assignments.length === 0) {
      readyOrders.forEach(order => {
        if (order.latitude && order.longitude) {
          const el = document.createElement("div");
          el.className = "w-6 h-6 rounded-full bg-muted-foreground border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold";
          el.innerHTML = order.priority === 2 ? "!" : order.priority === 1 ? "•" : "";
          
          const marker = new mapboxgl.Marker(el)
            .setLngLat([order.longitude, order.latitude])
            .setPopup(new mapboxgl.Popup().setHTML(`
              <strong>${escapeHtml(order.customer_name)}</strong><br/>
              ${escapeHtml(order.order_number)}<br/>
              ${escapeHtml(order.customer_address || "No address")}
            `))
            .addTo(map.current!);
          
          markersRef.current.push(marker);
        }
      });
      return;
    }

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

        if (stop.is_locked) {
          el.style.border = "3px solid gold";
        }
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat([stop.longitude, stop.latitude])
          .setPopup(new mapboxgl.Popup().setHTML(`
            <strong>${escapeHtml(stop.customer_name)}</strong><br/>
            Order: ${escapeHtml(stop.order_number)}<br/>
            Stop #${stop.sequence}${stop.is_locked ? " 🔒" : ""}<br/>
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

  const toggleLockOrder = async (orderId: string, currentLocked: boolean) => {
    const { error } = await supabase
      .from("distribution_orders")
      .update({ 
        assignment_locked: !currentLocked,
        manual_override_at: !currentLocked ? new Date().toISOString() : null 
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update lock status");
      return;
    }

    setAssignments(prev => prev.map(a => ({
      ...a,
      stops: a.stops.map(s => 
        s.order_id === orderId ? { ...s, is_locked: !currentLocked } : s
      )
    })));

    toast.success(currentLocked ? "Order unlocked" : "Order locked - won't be re-optimized");
  };

  const reassignOrder = (orderId: string, newDriverId: string) => {
    const newDriver = availableDrivers.find(d => d.id === newDriverId);
    if (!newDriver) return;

    setAssignments(prev => {
      // Remove from current driver
      const updated = prev.map(a => ({
        ...a,
        stops: a.stops.filter(s => s.order_id !== orderId),
        total_stops: a.stops.filter(s => s.order_id !== orderId).length
      }));

      // Find the stop data
      let movedStop: any = null;
      prev.forEach(a => {
        const stop = a.stops.find(s => s.order_id === orderId);
        if (stop) movedStop = stop;
      });

      if (!movedStop) return prev;

      // Add to new driver
      const targetIdx = updated.findIndex(a => a.driver_id === newDriverId);
      if (targetIdx >= 0) {
        updated[targetIdx].stops.push({
          ...movedStop,
          sequence: updated[targetIdx].stops.length + 1,
          is_locked: true
        });
        updated[targetIdx].total_stops = updated[targetIdx].stops.length;
      } else {
        updated.push({
          driver_id: newDriverId,
          driver_name: newDriver.name,
          stops: [{ ...movedStop, sequence: 1, is_locked: true }],
          total_stops: 1,
          estimated_duration_minutes: 15,
          total_distance_km: 0
        });
      }

      return updated.filter(a => a.stops.length > 0);
    });

    toast.success(`Order reassigned to ${newDriver.name}`);
  };

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      for (const assignment of assignments) {
        for (const stop of assignment.stops) {
          const { error } = await supabase
            .from("distribution_orders")
            .update({
              status: "out_for_delivery",
              driver_id: assignment.driver_id,
              driver_name: assignment.driver_name,
              assigned_at: new Date().toISOString(),
              assignment_locked: stop.is_locked || false
            })
            .eq("id", stop.order_id);
          
          if (error) throw error;
        }
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
  const lockedCount = assignments.reduce((sum, a) => sum + a.stops.filter(s => s.is_locked).length, 0);

  return (
    <div className="h-full w-full overflow-hidden bg-background">
      <div className="h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row">
        {/* Left Panel */}
        <div className="w-full lg:w-64 xl:w-80 border-b lg:border-b-0 lg:border-r flex flex-col shrink-0 max-h-[40vh] lg:max-h-none">
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
                    order.priority === 1 && "border-orange-500 bg-orange-500/5",
                    order.assignment_locked && "border-amber-400"
                  )}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{order.customer_name}</span>
                            {order.assignment_locked && <Lock className="h-3 w-3 text-amber-500" />}
                            {order.priority === 2 && <Badge variant="destructive" className="text-[10px] px-1">CRITICAL</Badge>}
                            {order.priority === 1 && <Badge className="bg-orange-500 text-[10px] px-1">URGENT</Badge>}
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
        <div className="flex-1 relative min-h-[300px] min-w-0">
          <div ref={mapContainer} className="absolute inset-0" />
          
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
                  {lockedCount > 0 && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-amber-500" />
                        <span className="font-medium">{lockedCount}</span>
                        <span className="text-muted-foreground">locked</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right Panel - Route Assignments */}
        <div className="w-full lg:w-72 xl:w-96 border-t lg:border-t-0 lg:border-l flex flex-col shrink-0 max-h-[40vh] lg:max-h-none">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Route className="h-4 w-4" />
              Route Assignments
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Drag stops to reassign • Lock to prevent re-optimization
            </p>
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
                      "transition-all",
                      selectedDriver === assignment.driver_id && "ring-2 ring-primary"
                    )}
                  >
                    <CardHeader 
                      className="py-2 px-3 cursor-pointer"
                      onClick={() => setSelectedDriver(
                        selectedDriver === assignment.driver_id ? null : assignment.driver_id
                      )}
                    >
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
                        {assignment.stops.map((stop) => (
                          <div 
                            key={stop.order_id} 
                            className={cn(
                              "flex items-center gap-2 text-xs p-1.5 rounded border",
                              stop.is_locked && "border-amber-400 bg-amber-400/10"
                            )}
                          >
                            <GripVertical className="h-3 w-3 text-muted-foreground cursor-move" />
                            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                              {stop.sequence}
                            </span>
                            <span className="truncate flex-1">{stop.customer_name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {stop.priority === 2 && <AlertTriangle className="h-3 w-3 text-red-500" />}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLockOrder(stop.order_id, stop.is_locked || false);
                                }}
                              >
                                {stop.is_locked ? (
                                  <Lock className="h-3 w-3 text-amber-500" />
                                ) : (
                                  <Unlock className="h-3 w-3 text-muted-foreground" />
                                )}
                              </Button>
                              <Select
                                value=""
                                onValueChange={(newDriverId) => reassignOrder(stop.order_id, newDriverId)}
                              >
                                <SelectTrigger className="h-5 w-5 p-0 border-0">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableDrivers
                                    .filter(d => d.id !== assignment.driver_id)
                                    .map(driver => (
                                      <SelectItem key={driver.id} value={driver.id}>
                                        Move to {driver.name}
                                      </SelectItem>
                                    ))
                                  }
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))}
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
      </div>
    </div>
  );
};

export default FnbDispatch;
