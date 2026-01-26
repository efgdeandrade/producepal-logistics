import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { MapLoadingState, WebGLError } from "@/components/maps/MapLoadingState";
import { isWebGLSupported, escapeHtml, MAP_LOAD_TIMEOUT } from "@/lib/mapUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface AttendanceLocation {
  id: string;
  clock_in: string;
  location_lat: number;
  location_lng: number;
  employees: {
    full_name: string;
    department: string | null;
  } | null;
}

export function AttendanceMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  
  const { token: mapToken } = useMapboxToken();

  const { data: locations, isLoading: dataLoading } = useQuery({
    queryKey: ["attendance-locations", selectedDate.toISOString()],
    queryFn: async () => {
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = endOfDay(selectedDate).toISOString();

      const { data, error } = await supabase
        .from("time_entries")
        .select(
          `
          id,
          clock_in,
          location_lat,
          location_lng,
          employees (full_name, department)
        `
        )
        .gte("clock_in", dayStart)
        .lte("clock_in", dayEnd)
        .not("location_lat", "is", null)
        .not("location_lng", "is", null);

      if (error) throw error;
      return data as AttendanceLocation[];
    },
    enabled: !!mapToken,
  });

  // Check WebGL support once on mount
  useEffect(() => {
    if (!isWebGLSupported()) {
      setWebGLSupported(false);
      setIsLoading(false);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapToken || !webGLSupported || map.current) return;

    setIsLoading(true);
    setError(null);

    try {
      mapboxgl.accessToken = mapToken;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-61.5, 10.5], // Default to Trinidad
        zoom: 10,
      });

      // Set up loading timeout
      const timeoutId = setTimeout(() => {
        if (!mapLoaded && map.current) {
          console.error('[AttendanceMap] Map load timeout');
          setError('Map is taking too long to load. Please check your connection.');
          setIsLoading(false);
        }
      }, MAP_LOAD_TIMEOUT);

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.current.on('load', () => {
        clearTimeout(timeoutId);
        console.log('[AttendanceMap] Map loaded successfully');
        setMapLoaded(true);
        setIsLoading(false);
        setError(null);
      });

      map.current.on('error', (e) => {
        console.error('[AttendanceMap] Mapbox error:', e);
        clearTimeout(timeoutId);
        setError('Map failed to load. Please try again.');
        setIsLoading(false);
      });
    } catch (err) {
      console.error('[AttendanceMap] Initialization error:', err);
      setError('Failed to initialize map. Please refresh the page.');
      setIsLoading(false);
    }

    return () => {
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
    };
  }, [mapToken, webGLSupported, retryCount]);

  // Retry handler
  const handleRetry = useCallback(() => {
    console.log('[AttendanceMap] Retrying map initialization...');
    map.current?.remove();
    map.current = null;
    setMapLoaded(false);
    setRetryCount((prev) => prev + 1);
  }, []);

  // Update markers when locations change
  useEffect(() => {
    if (!map.current || !mapLoaded || !locations) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (locations.length === 0) return;

    // Add new markers
    const bounds = new mapboxgl.LngLatBounds();

    locations.forEach((location) => {
      const el = document.createElement("div");
      el.className = "flex items-center justify-center";
      el.innerHTML = `
        <div class="bg-primary text-primary-foreground rounded-full p-2 shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-2">
          <p class="font-semibold">${escapeHtml(location.employees?.full_name || "Unknown")}</p>
          <p class="text-sm text-gray-500">${escapeHtml(location.employees?.department || "No department")}</p>
          <p class="text-xs text-gray-400">${format(new Date(location.clock_in), "h:mm a")}</p>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.location_lng, location.location_lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
      bounds.extend([location.location_lng, location.location_lat]);
    });

    // Fit map to show all markers
    if (locations.length > 0) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15,
      });
    }
  }, [locations, mapLoaded]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Attendance Locations
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(selectedDate, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent>
        <div className="relative h-[400px] rounded-lg overflow-hidden">
          {!webGLSupported ? (
            <WebGLError />
          ) : (
            <>
              <div ref={mapContainer} className="h-full w-full" />
              <MapLoadingState 
                isLoading={isLoading || dataLoading} 
                error={error} 
                onRetry={handleRetry}
              />
            </>
          )}
          {mapLoaded && locations && locations.length === 0 && !dataLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 pointer-events-none">
              <p className="text-muted-foreground">
                No GPS entries for this date
              </p>
            </div>
          )}
        </div>
        {locations && locations.length > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            {locations.length} clock-in location{locations.length !== 1 && "s"}{" "}
            on {format(selectedDate, "MMMM d, yyyy")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
