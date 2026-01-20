import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Crosshair } from "lucide-react";
import { useMapboxToken } from "@/hooks/useMapboxToken";
// Curaçao coordinates
const CURACAO_CENTER: [number, number] = [-68.9900, 12.1696];
const CURACAO_BOUNDS: [[number, number], [number, number]] = [
  [-69.2, 12.0], // Southwest
  [-68.7, 12.4], // Northeast
];

// Helper to escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

interface Zone {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  center_latitude?: number | null;
  center_longitude?: number | null;
  radius_meters?: number | null;
  customer_count?: number;
}

interface Customer {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  delivery_zone?: string | null;
}

interface ZoneMapViewProps {
  zones: Zone[];
  customers: Customer[];
  selectedZone: Zone | null;
  onZoneSelect: (zone: Zone | null) => void;
  onMapClick?: (lng: number, lat: number) => void;
  isDrawingMode?: boolean;
  drawingCenter?: { lng: number; lat: number } | null;
  drawingRadius?: number;
}

// Generate consistent colors for zones
const getZoneColor = (index: number): string => {
  const colors = [
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#06b6d4", // cyan
    "#f97316", // orange
    "#ec4899", // pink
  ];
  return colors[index % colors.length];
};

export default function ZoneMapView({
  zones,
  customers,
  selectedZone,
  onZoneSelect,
  onMapClick,
  isDrawingMode = false,
  drawingCenter,
  drawingRadius = 1000,
}: ZoneMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { token } = useMapboxToken();

  // Initialize map after token is loaded
  useEffect(() => {
    if (!mapContainer.current || map.current || !token) return;

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: CURACAO_CENTER,
      zoom: 11,
      maxBounds: CURACAO_BOUNDS,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      "top-right"
    );

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    map.current.on("click", (e) => {
      if (onMapClick) {
        onMapClick(e.lngLat.lng, e.lngLat.lat);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [token]);

  // Handle map click callback updates
  useEffect(() => {
    if (!map.current) return;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (onMapClick) {
        onMapClick(e.lngLat.lng, e.lngLat.lat);
      }
    };

    map.current.off("click", handleClick);
    map.current.on("click", handleClick);

    return () => {
      map.current?.off("click", handleClick);
    };
  }, [onMapClick]);

  // Draw zone circles
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing zone layers
    zones.forEach((zone, index) => {
      const sourceId = `zone-${zone.id}`;
      if (map.current?.getLayer(`${sourceId}-fill`)) {
        map.current.removeLayer(`${sourceId}-fill`);
      }
      if (map.current?.getLayer(`${sourceId}-outline`)) {
        map.current.removeLayer(`${sourceId}-outline`);
      }
      if (map.current?.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });

    // Add zone circles
    zones.forEach((zone, index) => {
      if (!zone.center_latitude || !zone.center_longitude) return;

      const sourceId = `zone-${zone.id}`;
      const color = getZoneColor(index);
      const isSelected = selectedZone?.id === zone.id;
      const radius = zone.radius_meters || 1000;

      // Create circle GeoJSON
      const circleGeoJSON = createCircleGeoJSON(
        [zone.center_longitude, zone.center_latitude],
        radius
      );

      map.current?.addSource(sourceId, {
        type: "geojson",
        data: circleGeoJSON,
      });

      map.current?.addLayer({
        id: `${sourceId}-fill`,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": color,
          "fill-opacity": isSelected ? 0.4 : 0.2,
        },
      });

      map.current?.addLayer({
        id: `${sourceId}-outline`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": color,
          "line-width": isSelected ? 3 : 2,
          "line-dasharray": isSelected ? [1, 0] : [2, 2],
        },
      });
    });
  }, [zones, selectedZone, mapLoaded]);

  // Draw temporary drawing circle
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = "drawing-circle";

    if (map.current.getLayer(`${sourceId}-fill`)) {
      map.current.removeLayer(`${sourceId}-fill`);
    }
    if (map.current.getLayer(`${sourceId}-outline`)) {
      map.current.removeLayer(`${sourceId}-outline`);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    if (drawingCenter && isDrawingMode) {
      const circleGeoJSON = createCircleGeoJSON(
        [drawingCenter.lng, drawingCenter.lat],
        drawingRadius
      );

      map.current.addSource(sourceId, {
        type: "geojson",
        data: circleGeoJSON,
      });

      map.current.addLayer({
        id: `${sourceId}-fill`,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.3,
        },
      });

      map.current.addLayer({
        id: `${sourceId}-outline`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#3b82f6",
          "line-width": 3,
        },
      });
    }
  }, [drawingCenter, drawingRadius, isDrawingMode, mapLoaded]);

  // Add customer markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    customers.forEach((customer) => {
      if (!customer.latitude || !customer.longitude) return;

      const el = document.createElement("div");
      el.className = "customer-marker";
      el.innerHTML = `
        <div style="
          width: 24px;
          height: 24px;
          background: #ef4444;
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      `;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([customer.longitude, customer.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <strong>${escapeHtml(customer.name)}</strong>
            ${customer.delivery_zone ? `<br/><small>Zone: ${escapeHtml(customer.delivery_zone)}</small>` : ""}
          `)
        )
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [customers, mapLoaded]);

  // Fit bounds when zones change
  useEffect(() => {
    if (!map.current || !mapLoaded || zones.length === 0) return;

    const zonesWithCoords = zones.filter(
      (z) => z.center_latitude && z.center_longitude
    );

    if (zonesWithCoords.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      zonesWithCoords.forEach((zone) => {
        bounds.extend([zone.center_longitude!, zone.center_latitude!]);
      });
      map.current.fitBounds(bounds, { padding: 100, maxZoom: 13 });
    }
  }, [zones, mapLoaded]);

  // Update cursor when in drawing mode
  useEffect(() => {
    if (!map.current) return;
    map.current.getCanvas().style.cursor = isDrawingMode ? "crosshair" : "";
  }, [isDrawingMode]);

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg" />

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border max-w-[250px]">
        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Zones
        </h4>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {zones.map((zone, index) => (
            <button
              key={zone.id}
              onClick={() => onZoneSelect(selectedZone?.id === zone.id ? null : zone)}
              className={`w-full flex items-center gap-2 p-1.5 rounded text-left text-xs transition-colors ${
                selectedZone?.id === zone.id
                  ? "bg-primary/10"
                  : "hover:bg-muted"
              }`}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: getZoneColor(index) }}
              />
              <span className="truncate flex-1">{zone.name}</span>
              {zone.customer_count !== undefined && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {zone.customer_count}
                </Badge>
              )}
            </button>
          ))}
          {zones.length === 0 && (
            <p className="text-xs text-muted-foreground">No zones with coordinates</p>
          )}
        </div>
      </div>

      {/* Drawing mode indicator */}
      {isDrawingMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Crosshair className="h-4 w-4" />
          <span className="text-sm font-medium">Click on map to set zone center</span>
        </div>
      )}

      {/* Customer count */}
      <div className="absolute bottom-4 right-4 bg-background/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4" />
          <span>{customers.filter((c) => c.latitude && c.longitude).length} customers on map</span>
        </div>
      </div>
    </div>
  );
}

// Helper function to create a circle GeoJSON polygon
function createCircleGeoJSON(
  center: [number, number],
  radiusMeters: number,
  points: number = 64
): GeoJSON.FeatureCollection {
  const coords: [number, number][] = [];
  const distanceX = radiusMeters / (111320 * Math.cos((center[1] * Math.PI) / 180));
  const distanceY = radiusMeters / 110540;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([center[0] + x, center[1] + y]);
  }
  coords.push(coords[0]); // Close the polygon

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [coords],
        },
      },
    ],
  };
}
