import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Undo2, Trash2, Check, MousePointer2 } from "lucide-react";

// Curaçao coordinates
const CURACAO_CENTER: [number, number] = [-68.9900, 12.1696];
const CURACAO_BOUNDS: [[number, number], [number, number]] = [
  [-69.2, 12.0],
  [-68.7, 12.4],
];

interface Customer {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  delivery_zone?: string | null;
}

interface PolygonDrawingMapProps {
  initialPolygon?: [number, number][] | null;
  customers: Customer[];
  onPolygonChange: (polygon: [number, number][] | null) => void;
  zoneColor?: string;
}

export default function PolygonDrawingMap({
  initialPolygon,
  customers,
  onPolygonChange,
  zoneColor = "#3b82f6",
}: PolygonDrawingMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const vertexMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [vertices, setVertices] = useState<[number, number][]>(initialPolygon || []);
  const [isDrawing, setIsDrawing] = useState(!initialPolygon || initialPolygon.length === 0);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = "pk.eyJ1IjoiZnVpayIsImEiOiJjbWppanJ1NmgxczhlM2VvdHVvYWdrdTk4In0.PMmNjfuH2z3Rg26Idf0mjg";

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

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Handle map clicks for drawing
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (!isDrawing) return;
      
      const newVertex: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setVertices((prev) => [...prev, newVertex]);
    };

    map.current.on("click", handleClick);
    return () => {
      map.current?.off("click", handleClick);
    };
  }, [mapLoaded, isDrawing]);

  // Update polygon on vertices change
  useEffect(() => {
    onPolygonChange(vertices.length >= 3 ? vertices : null);
  }, [vertices, onPolygonChange]);

  // Draw polygon
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = "drawing-polygon";
    const lineSourceId = "drawing-line";

    // Remove existing layers/sources
    if (map.current.getLayer(`${sourceId}-fill`)) {
      map.current.removeLayer(`${sourceId}-fill`);
    }
    if (map.current.getLayer(`${sourceId}-outline`)) {
      map.current.removeLayer(`${sourceId}-outline`);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }
    if (map.current.getLayer(`${lineSourceId}-line`)) {
      map.current.removeLayer(`${lineSourceId}-line`);
    }
    if (map.current.getSource(lineSourceId)) {
      map.current.removeSource(lineSourceId);
    }

    // Remove vertex markers
    vertexMarkersRef.current.forEach((m) => m.remove());
    vertexMarkersRef.current = [];

    if (vertices.length === 0) return;

    // Draw line connecting vertices
    if (vertices.length >= 1) {
      const lineCoords = [...vertices];
      if (vertices.length >= 3) {
        lineCoords.push(vertices[0]); // Close polygon
      }

      map.current.addSource(lineSourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: lineCoords,
          },
        },
      });

      map.current.addLayer({
        id: `${lineSourceId}-line`,
        type: "line",
        source: lineSourceId,
        paint: {
          "line-color": zoneColor,
          "line-width": 3,
          "line-dasharray": vertices.length >= 3 ? [1, 0] : [2, 2],
        },
      });
    }

    // Draw filled polygon if we have at least 3 vertices
    if (vertices.length >= 3) {
      const closedCoords = [...vertices, vertices[0]];

      map.current.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [closedCoords],
          },
        },
      });

      map.current.addLayer({
        id: `${sourceId}-fill`,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": zoneColor,
          "fill-opacity": 0.25,
        },
      });

      map.current.addLayer({
        id: `${sourceId}-outline`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": zoneColor,
          "line-width": 3,
        },
      });
    }

    // Add vertex markers
    vertices.forEach((vertex, index) => {
      const el = document.createElement("div");
      el.className = "vertex-marker";
      el.style.cssText = `
        width: 14px;
        height: 14px;
        background: ${zoneColor};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;

      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat(vertex)
        .addTo(map.current!);

      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        setVertices((prev) => {
          const newVertices = [...prev];
          newVertices[index] = [lngLat.lng, lngLat.lat];
          return newVertices;
        });
      });

      vertexMarkersRef.current.push(marker);
    });
  }, [vertices, mapLoaded, zoneColor]);

  // Add customer markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    customers.forEach((customer) => {
      if (!customer.latitude || !customer.longitude) return;

      const isInZone = vertices.length >= 3 && isPointInPolygon(
        [customer.longitude, customer.latitude],
        vertices
      );

      const el = document.createElement("div");
      el.innerHTML = `
        <div style="
          width: 20px;
          height: 20px;
          background: ${isInZone ? "#22c55e" : "#6b7280"};
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
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
            <strong>${customer.name}</strong>
            <br/><small>${isInZone ? "✓ In zone" : "Outside zone"}</small>
          `)
        )
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [customers, vertices, mapLoaded]);

  // Update cursor
  useEffect(() => {
    if (!map.current) return;
    map.current.getCanvas().style.cursor = isDrawing ? "crosshair" : "";
  }, [isDrawing]);

  const undoLastVertex = () => {
    setVertices((prev) => prev.slice(0, -1));
  };

  const clearPolygon = () => {
    setVertices([]);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    if (vertices.length >= 3) {
      setIsDrawing(false);
    }
  };

  const customersInZone = vertices.length >= 3
    ? customers.filter(
        (c) =>
          c.latitude &&
          c.longitude &&
          isPointInPolygon([c.longitude, c.latitude], vertices)
      )
    : [];

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg" />

      {/* Drawing Controls */}
      <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MousePointer2 className="h-4 w-4" />
          {isDrawing ? "Drawing Mode" : "Edit Mode"}
        </div>
        
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={undoLastVertex}
            disabled={vertices.length === 0}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearPolygon}
            disabled={vertices.length === 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {isDrawing && vertices.length >= 3 && (
            <Button
              variant="default"
              size="sm"
              onClick={finishDrawing}
            >
              <Check className="h-4 w-4 mr-1" />
              Done
            </Button>
          )}
          {!isDrawing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDrawing(true)}
            >
              Edit
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {vertices.length} vertices
          {vertices.length < 3 && isDrawing && (
            <span> • Click {3 - vertices.length} more to close</span>
          )}
        </div>
      </div>

      {/* Customers in zone */}
      <div className="absolute bottom-4 right-4 bg-background/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border">
        <Badge variant={customersInZone.length > 0 ? "default" : "secondary"}>
          {customersInZone.length} customers in zone
        </Badge>
      </div>

      {/* Drawing instructions */}
      {isDrawing && vertices.length < 3 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm">
          Click on the map to add polygon vertices
        </div>
      )}
    </div>
  );
}

// Ray casting algorithm to check if point is inside polygon
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

// Export for use in other components
export { isPointInPolygon };
