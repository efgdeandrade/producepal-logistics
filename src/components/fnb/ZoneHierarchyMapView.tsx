import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMapboxToken } from "@/hooks/useMapboxToken";

// Curaçao coordinates
const CURACAO_CENTER: [number, number] = [-68.9900, 12.1696];
const CURACAO_BOUNDS: [[number, number], [number, number]] = [
  [-69.2, 12.0],
  [-68.7, 12.4],
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
  zone_type: "major" | "sub";
  parent_zone_id: string | null;
  center_latitude?: number | null;
  center_longitude?: number | null;
  radius_meters?: number | null;
  polygon_coordinates?: [number, number][] | null;
  customer_count?: number;
}

interface Customer {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  delivery_zone?: string | null;
}

interface ZoneHierarchyMapViewProps {
  zones: Zone[];
  customers: Customer[];
  selectedZone: Zone | null;
  onZoneSelect: (zone: Zone | null) => void;
  onMapClick?: (lng: number, lat: number) => void;
}

// Major zone colors
const MAJOR_ZONE_COLORS: Record<string, string> = {
  Pariba: "#3b82f6",   // Blue
  Pabou: "#22c55e",    // Green
  Meimei: "#f59e0b",   // Amber
};

const getZoneColor = (zone: Zone, zones: Zone[]): string => {
  if (zone.zone_type === "major") {
    return MAJOR_ZONE_COLORS[zone.name] || "#8b5cf6";
  }
  
  // Sub-zone: inherit parent color with variation
  if (zone.parent_zone_id) {
    const parent = zones.find((z) => z.id === zone.parent_zone_id);
    if (parent) {
      return MAJOR_ZONE_COLORS[parent.name] || "#8b5cf6";
    }
  }
  
  return "#6b7280"; // Unassigned sub-zone
};

export default function ZoneHierarchyMapView({
  zones,
  customers,
  selectedZone,
  onZoneSelect,
  onMapClick,
}: ZoneHierarchyMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [expandedMajorZones, setExpandedMajorZones] = useState<Set<string>>(new Set());
  const { token } = useMapboxToken();

  const majorZones = zones.filter((z) => z.zone_type === "major");
  const subZones = zones.filter((z) => z.zone_type === "sub");

  // Initialize map
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

  // Draw zones
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing zone layers
    zones.forEach((zone) => {
      const sourceId = `zone-${zone.id}`;
      ["fill", "outline"].forEach((suffix) => {
        if (map.current?.getLayer(`${sourceId}-${suffix}`)) {
          map.current.removeLayer(`${sourceId}-${suffix}`);
        }
      });
      if (map.current?.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });

    // Draw zones - major zones first (background), then sub-zones
    const sortedZones = [...majorZones, ...subZones];

    sortedZones.forEach((zone) => {
      const color = getZoneColor(zone, zones);
      const isSelected = selectedZone?.id === zone.id;
      const isMajor = zone.zone_type === "major";
      const sourceId = `zone-${zone.id}`;

      let geoJSON: GeoJSON.FeatureCollection | null = null;

      // Check for polygon coordinates first
      if (zone.polygon_coordinates && zone.polygon_coordinates.length >= 3) {
        const closedCoords = [...zone.polygon_coordinates, zone.polygon_coordinates[0]];
        geoJSON = {
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [closedCoords],
            },
          }],
        };
      } else if (zone.center_latitude && zone.center_longitude) {
        // Fallback to circle
        geoJSON = createCircleGeoJSON(
          [zone.center_longitude, zone.center_latitude],
          zone.radius_meters || 1000
        );
      }

      if (!geoJSON) return;

      map.current?.addSource(sourceId, {
        type: "geojson",
        data: geoJSON,
      });

      map.current?.addLayer({
        id: `${sourceId}-fill`,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": color,
          "fill-opacity": isSelected ? 0.4 : isMajor ? 0.15 : 0.25,
        },
      });

      map.current?.addLayer({
        id: `${sourceId}-outline`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": color,
          "line-width": isSelected ? 4 : isMajor ? 3 : 2,
          "line-dasharray": isMajor ? [4, 2] : [1, 0],
        },
      });
    });
  }, [zones, selectedZone, mapLoaded, majorZones, subZones]);

  // Add customer markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    customers.forEach((customer) => {
      if (!customer.latitude || !customer.longitude) return;

      const el = document.createElement("div");
      el.innerHTML = `
        <div style="
          width: 20px;
          height: 20px;
          background: #ef4444;
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
        ">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
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

  const toggleMajorZone = (zoneId: string) => {
    setExpandedMajorZones((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) {
        next.delete(zoneId);
      } else {
        next.add(zoneId);
      }
      return next;
    });
  };

  const getSubZonesForMajor = (majorZoneId: string) => {
    return subZones.filter((z) => z.parent_zone_id === majorZoneId);
  };

  const unassignedSubZones = subZones.filter((z) => !z.parent_zone_id);

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg" />

      {/* Hierarchical Zone Legend */}
      <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border max-w-[280px] max-h-[400px] overflow-y-auto">
        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Delivery Zones
        </h4>

        <div className="space-y-1">
          {/* Major Zones */}
          {majorZones.map((major) => {
            const isExpanded = expandedMajorZones.has(major.id);
            const children = getSubZonesForMajor(major.id);
            const color = getZoneColor(major, zones);

            return (
              <div key={major.id}>
                <button
                  onClick={() => {
                    onZoneSelect(selectedZone?.id === major.id ? null : major);
                    if (children.length > 0) {
                      toggleMajorZone(major.id);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 rounded text-left text-sm transition-colors",
                    selectedZone?.id === major.id ? "bg-primary/10" : "hover:bg-muted"
                  )}
                >
                  {children.length > 0 && (
                    isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                  )}
                  <div
                    className="w-4 h-4 rounded shrink-0 border-2"
                    style={{ backgroundColor: color, borderColor: color }}
                  />
                  <span className="font-medium truncate flex-1">{major.name}</span>
                  <Badge variant="outline" className="text-xs px-1.5">
                    {major.customer_count || 0}
                  </Badge>
                </button>

                {/* Sub-zones */}
                {isExpanded && children.length > 0 && (
                  <div className="ml-6 border-l pl-2 space-y-1 mt-1">
                    {children.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => onZoneSelect(selectedZone?.id === sub.id ? null : sub)}
                        className={cn(
                          "w-full flex items-center gap-2 p-1.5 rounded text-left text-xs transition-colors",
                          selectedZone?.id === sub.id ? "bg-primary/10" : "hover:bg-muted"
                        )}
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate flex-1">{sub.name}</span>
                        <span className="text-muted-foreground">{sub.customer_count || 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned Sub-zones */}
          {unassignedSubZones.length > 0 && (
            <div className="border-t pt-2 mt-2">
              <p className="text-xs text-muted-foreground mb-1">Unassigned:</p>
              {unassignedSubZones.map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => onZoneSelect(selectedZone?.id === zone.id ? null : zone)}
                  className={cn(
                    "w-full flex items-center gap-2 p-1.5 rounded text-left text-xs transition-colors",
                    selectedZone?.id === zone.id ? "bg-primary/10" : "hover:bg-muted"
                  )}
                >
                  <div className="w-3 h-3 rounded-full shrink-0 bg-muted-foreground" />
                  <span className="truncate flex-1">{zone.name}</span>
                  <span className="text-muted-foreground">{zone.customer_count || 0}</span>
                </button>
              ))}
            </div>
          )}

          {zones.length === 0 && (
            <p className="text-xs text-muted-foreground">No zones configured</p>
          )}
        </div>
      </div>

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
  coords.push(coords[0]);

  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [coords],
      },
    }],
  };
}
