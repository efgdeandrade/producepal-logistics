import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_address: string;
  latitude: number | null;
  longitude: number | null;
  delivery_zone: string | null;
  total_xcg: number;
  priority: number;
  item_count: number;
}

interface Driver {
  id: string;
  name: string;
  email: string;
  vehicle_capacity: number;
  start_time: string;
  end_time: string;
}

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

// Haversine distance calculation
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Nearest neighbor algorithm for route optimization
function optimizeStopSequence(stops: Order[], startLat: number, startLon: number): Order[] {
  if (stops.length <= 1) return stops;
  
  const optimized: Order[] = [];
  const remaining = [...stops];
  let currentLat = startLat;
  let currentLon = startLon;
  
  // Always put critical orders first
  const criticalOrders = remaining.filter(o => o.priority === 2);
  const urgentOrders = remaining.filter(o => o.priority === 1);
  const normalOrders = remaining.filter(o => o.priority === 0);
  
  // Add critical orders first (in nearest neighbor order)
  while (criticalOrders.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    
    for (let i = 0; i < criticalOrders.length; i++) {
      const order = criticalOrders[i];
      if (order.latitude && order.longitude) {
        const dist = getDistanceKm(currentLat, currentLon, order.latitude, order.longitude);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }
    }
    
    const nearest = criticalOrders.splice(nearestIdx, 1)[0];
    optimized.push(nearest);
    if (nearest.latitude && nearest.longitude) {
      currentLat = nearest.latitude;
      currentLon = nearest.longitude;
    }
  }
  
  // Then urgent orders
  while (urgentOrders.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    
    for (let i = 0; i < urgentOrders.length; i++) {
      const order = urgentOrders[i];
      if (order.latitude && order.longitude) {
        const dist = getDistanceKm(currentLat, currentLon, order.latitude, order.longitude);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }
    }
    
    const nearest = urgentOrders.splice(nearestIdx, 1)[0];
    optimized.push(nearest);
    if (nearest.latitude && nearest.longitude) {
      currentLat = nearest.latitude;
      currentLon = nearest.longitude;
    }
  }
  
  // Finally normal orders with nearest neighbor
  while (normalOrders.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    
    for (let i = 0; i < normalOrders.length; i++) {
      const order = normalOrders[i];
      if (order.latitude && order.longitude) {
        const dist = getDistanceKm(currentLat, currentLon, order.latitude, order.longitude);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }
    }
    
    const nearest = normalOrders.splice(nearestIdx, 1)[0];
    optimized.push(nearest);
    if (nearest.latitude && nearest.longitude) {
      currentLat = nearest.latitude;
      currentLon = nearest.longitude;
    }
  }
  
  return optimized;
}

// Calculate route duration and distance
function calculateRouteMetrics(stops: Order[]): { duration: number; distance: number } {
  let totalDistance = 0;
  const baseStopTime = 5; // 5 minutes per stop
  
  // Start from approximate center of Curacao
  let prevLat = 12.1696;
  let prevLon = -68.9900;
  
  for (const stop of stops) {
    if (stop.latitude && stop.longitude) {
      totalDistance += getDistanceKm(prevLat, prevLon, stop.latitude, stop.longitude);
      prevLat = stop.latitude;
      prevLon = stop.longitude;
    }
  }
  
  // Assume 30 km/h average speed in urban areas
  const drivingTime = (totalDistance / 30) * 60;
  const stopTime = stops.length * baseStopTime;
  
  return {
    duration: Math.round(drivingTime + stopTime),
    distance: Math.round(totalDistance * 10) / 10
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { date } = await req.json();
    const targetDate = date || new Date().toISOString().split("T")[0];

    console.log(`Optimizing routes for date: ${targetDate}`);

    // 1. Get available drivers for the date
    const { data: availabilityData, error: availError } = await supabase
      .from("driver_availability")
      .select(`
        driver_id,
        is_available,
        start_time,
        end_time,
        vehicle_capacity,
        profiles!inner(id, email, full_name)
      `)
      .eq("date", targetDate)
      .eq("is_available", true);

    if (availError) {
      console.error("Error fetching driver availability:", availError);
      throw new Error("Failed to fetch driver availability");
    }

    // Also get all drivers with driver role if no availability set
    const { data: allDriversData, error: driversError } = await supabase
      .from("user_roles")
      .select(`
        user_id,
        profiles!inner(id, email, full_name)
      `)
      .eq("role", "driver");

    if (driversError) {
      console.error("Error fetching drivers:", driversError);
    }

    // Merge availability with all drivers (default available if no record)
    const driverMap = new Map<string, Driver>();
    
    // Add drivers with explicit availability
    if (availabilityData) {
      for (const av of availabilityData) {
        const profile = (av as any).profiles;
        driverMap.set(av.driver_id, {
          id: av.driver_id,
          name: profile.full_name || profile.email,
          email: profile.email,
          vehicle_capacity: av.vehicle_capacity || 50,
          start_time: av.start_time || "07:00",
          end_time: av.end_time || "18:00"
        });
      }
    }

    // Add remaining drivers with defaults (if no availability record exists)
    if (allDriversData && driverMap.size === 0) {
      for (const d of allDriversData) {
        const profile = (d as any).profiles;
        if (!driverMap.has(d.user_id)) {
          driverMap.set(d.user_id, {
            id: d.user_id,
            name: profile.full_name || profile.email,
            email: profile.email,
            vehicle_capacity: 50,
            start_time: "07:00",
            end_time: "18:00"
          });
        }
      }
    }

    const drivers = Array.from(driverMap.values());
    console.log(`Found ${drivers.length} available drivers`);

    if (drivers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No drivers available for this date",
          assignments: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get ready orders for the date
    const { data: ordersData, error: ordersError } = await supabase
      .from("fnb_orders")
      .select(`
        id,
        order_number,
        customer_id,
        total_xcg,
        priority,
        delivery_date,
        fnb_customers!inner(id, name, address, latitude, longitude, delivery_zone),
        fnb_order_items(id)
      `)
      .eq("status", "ready")
      .eq("delivery_date", targetDate);

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      throw new Error("Failed to fetch orders");
    }

    const orders: Order[] = (ordersData || []).map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      customer_id: o.customer_id,
      customer_name: o.fnb_customers.name,
      customer_address: o.fnb_customers.address || "No address",
      latitude: o.fnb_customers.latitude,
      longitude: o.fnb_customers.longitude,
      delivery_zone: o.fnb_customers.delivery_zone,
      total_xcg: o.total_xcg || 0,
      priority: o.priority || 0,
      item_count: o.fnb_order_items?.length || 1
    }));

    console.log(`Found ${orders.length} ready orders`);

    if (orders.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No orders ready for delivery",
          assignments: [],
          unassigned: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Cluster orders by zone and assign to drivers
    const ordersByZone = new Map<string, Order[]>();
    const unzonedOrders: Order[] = [];
    
    for (const order of orders) {
      const zone = order.delivery_zone || "unzoned";
      if (zone === "unzoned") {
        unzonedOrders.push(order);
      } else {
        if (!ordersByZone.has(zone)) {
          ordersByZone.set(zone, []);
        }
        ordersByZone.get(zone)!.push(order);
      }
    }

    // Sort zones by total orders (descending)
    const sortedZones = Array.from(ordersByZone.entries())
      .sort((a, b) => b[1].length - a[1].length);

    // Assign zones to drivers based on capacity
    const assignments: RouteAssignment[] = [];
    const driverLoads = new Map<string, Order[]>();
    
    for (const driver of drivers) {
      driverLoads.set(driver.id, []);
    }

    // Round-robin assignment of zones to drivers
    let driverIndex = 0;
    for (const [zone, zoneOrders] of sortedZones) {
      const driver = drivers[driverIndex % drivers.length];
      const currentLoad = driverLoads.get(driver.id)!;
      
      // Check capacity
      if (currentLoad.length + zoneOrders.length <= driver.vehicle_capacity) {
        currentLoad.push(...zoneOrders);
      } else {
        // Split if over capacity
        const remaining = driver.vehicle_capacity - currentLoad.length;
        currentLoad.push(...zoneOrders.slice(0, remaining));
        
        // Assign rest to next driver
        const overflow = zoneOrders.slice(remaining);
        if (overflow.length > 0) {
          const nextDriver = drivers[(driverIndex + 1) % drivers.length];
          driverLoads.get(nextDriver.id)!.push(...overflow);
        }
      }
      driverIndex++;
    }

    // Distribute unzoned orders
    for (const order of unzonedOrders) {
      // Find driver with least load
      let minLoadDriver = drivers[0];
      let minLoad = driverLoads.get(drivers[0].id)!.length;
      
      for (const driver of drivers) {
        const load = driverLoads.get(driver.id)!.length;
        if (load < minLoad && load < driver.vehicle_capacity) {
          minLoad = load;
          minLoadDriver = driver;
        }
      }
      
      driverLoads.get(minLoadDriver.id)!.push(order);
    }

    // 4. Optimize each driver's route and create assignments
    const curacaoCenter = { lat: 12.1696, lon: -68.9900 };
    
    for (const driver of drivers) {
      const driverOrders = driverLoads.get(driver.id)!;
      
      if (driverOrders.length === 0) continue;
      
      // Optimize stop sequence
      const optimizedStops = optimizeStopSequence(driverOrders, curacaoCenter.lat, curacaoCenter.lon);
      
      // Calculate metrics
      const metrics = calculateRouteMetrics(optimizedStops);
      
      // Calculate ETAs
      const startTime = new Date(`${targetDate}T${driver.start_time}`);
      let currentTime = new Date(startTime);
      const avgTimePerStop = metrics.duration / optimizedStops.length;
      
      const stops = optimizedStops.map((order, idx) => {
        const eta = new Date(currentTime);
        currentTime = new Date(currentTime.getTime() + avgTimePerStop * 60000);
        
        return {
          order_id: order.id,
          order_number: order.order_number,
          customer_name: order.customer_name,
          address: order.customer_address,
          latitude: order.latitude || curacaoCenter.lat,
          longitude: order.longitude || curacaoCenter.lon,
          priority: order.priority,
          sequence: idx + 1,
          estimated_arrival: eta.toISOString()
        };
      });
      
      assignments.push({
        driver_id: driver.id,
        driver_name: driver.name,
        stops,
        total_stops: stops.length,
        estimated_duration_minutes: metrics.duration,
        total_distance_km: metrics.distance
      });
    }

    // 5. Call AI for suggestions (optional enhancement)
    let aiSuggestions: string[] = [];
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY && assignments.length > 0) {
        const prompt = `Analyze these delivery route assignments and provide 2-3 brief optimization suggestions:
        
${assignments.map(a => `Driver: ${a.driver_name} - ${a.total_stops} stops, ${a.estimated_duration_minutes} min, ${a.total_distance_km} km`).join("\n")}

Total orders: ${orders.length}
Zones covered: ${Array.from(ordersByZone.keys()).join(", ")}

Provide actionable suggestions to improve efficiency.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a logistics optimization expert. Give brief, actionable suggestions." },
              { role: "user", content: prompt }
            ]
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            aiSuggestions = content.split("\n").filter((s: string) => s.trim().length > 0).slice(0, 3);
          }
        }
      }
    } catch (e) {
      console.log("AI suggestions unavailable:", e);
    }

    console.log(`Created ${assignments.length} route assignments`);

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        summary: {
          total_orders: orders.length,
          total_drivers: drivers.length,
          assignments_created: assignments.length
        },
        assignments,
        ai_suggestions: aiSuggestions
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in optimize-routes:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
