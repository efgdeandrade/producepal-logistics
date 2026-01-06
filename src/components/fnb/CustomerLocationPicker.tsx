import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

interface DeliveryZone {
  id: string;
  name: string;
  zone_type: string;
  parent_zone_id: string | null;
  center_latitude: number | null;
  center_longitude: number | null;
  radius_meters: number | null;
  polygon_coordinates: number[][] | null;
}

interface CustomerLocationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLocation?: { lat: number; lng: number } | null;
  customerName: string;
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    detectedZone?: string;
    detectedMajorZoneId?: string;
    detectedMajorZoneName?: string;
  }) => void;
}

// Curaçao bounds
const CURACAO_BOUNDS: [[number, number], [number, number]] = [
  [-69.2, 12.0],
  [-68.7, 12.45]
];
const CURACAO_CENTER: [number, number] = [-68.99, 12.17];

export function CustomerLocationPicker({
  open,
  onOpenChange,
  initialLocation,
  customerName,
  onLocationSelect,
}: CustomerLocationPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    initialLocation || null
  );
  const [detectedZone, setDetectedZone] = useState<{
    name: string;
    majorZoneId?: string;
    majorZoneName?: string;
  } | null>(null);

  // Fetch zones for display and detection
  const { data: zones } = useQuery({
    queryKey: ['fnb-delivery-zones-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fnb_delivery_zones')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data as DeliveryZone[];
    },
  });

  // Fetch Mapbox token when dialog opens
  const fetchMapToken = async () => {
    setTokenLoading(true);
    setMapError(null);
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error) {
        console.error('Error fetching mapbox token:', error);
        setMapError('Failed to load map configuration. Please try again.');
        return;
      }
      if (data?.token) {
        setMapToken(data.token);
      } else if (data?.error) {
        console.error('Token error:', data.error);
        setMapError(data.error);
      } else {
        setMapError('Invalid token response');
      }
    } catch (err) {
      console.error('Token fetch error:', err);
      setMapError('Failed to connect to map service');
    } finally {
      setTokenLoading(false);
    }
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedLocation(initialLocation || null);
      setDetectedZone(null);
      setMapError(null);
      // Fetch token if we don't have one
      if (!mapToken) {
        fetchMapToken();
      }
    } else {
      // Cleanup when closing
      marker.current?.remove();
      marker.current = null;
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
    }
  }, [open, initialLocation]);

  // Initialize map when token is available
  useEffect(() => {
    if (!open || !mapContainer.current || map.current || !mapToken) return;

    mapboxgl.accessToken = mapToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialLocation ? [initialLocation.lng, initialLocation.lat] : CURACAO_CENTER,
      zoom: initialLocation ? 15 : 11,
      maxBounds: CURACAO_BOUNDS,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
      // Force resize after dialog animation settles
      requestAnimationFrame(() => {
        map.current?.resize();
      });
    });

    map.current.on('error', (e) => {
      console.error('Mapbox error:', e);
      setMapError('Map failed to load. Check token or network.');
    });

    // Click to place marker
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setSelectedLocation({ lat, lng });
      updateMarker(lat, lng);
    });

    return () => {
      marker.current?.remove();
      marker.current = null;
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
    };
  }, [open, mapToken]);

  // Update marker position
  const updateMarker = (lat: number, lng: number) => {
    if (!map.current) return;

    if (marker.current) {
      marker.current.setLngLat([lng, lat]);
    } else {
      marker.current = new mapboxgl.Marker({
        color: '#ef4444',
        draggable: true,
      })
        .setLngLat([lng, lat])
        .addTo(map.current);

      marker.current.on('dragend', () => {
        const lngLat = marker.current?.getLngLat();
        if (lngLat) {
          setSelectedLocation({ lat: lngLat.lat, lng: lngLat.lng });
        }
      });
    }

    map.current.flyTo({ center: [lng, lat], zoom: 15 });
  };

  // Place initial marker when map loads
  useEffect(() => {
    if (mapLoaded && initialLocation) {
      updateMarker(initialLocation.lat, initialLocation.lng);
    }
  }, [mapLoaded, initialLocation]);

  // Draw zones on map
  useEffect(() => {
    if (!mapLoaded || !map.current || !zones) return;

    const majorZones = zones.filter(z => z.zone_type === 'major');
    const subZones = zones.filter(z => z.zone_type === 'sub');

    // Draw sub-zones with polygons
    subZones.forEach((zone) => {
      if (!zone.polygon_coordinates || !Array.isArray(zone.polygon_coordinates)) return;
      
      const sourceId = `zone-${zone.id}`;
      
      if (map.current?.getSource(sourceId)) return;

      try {
        map.current?.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { name: zone.name },
            geometry: {
              type: 'Polygon',
              coordinates: [zone.polygon_coordinates],
            },
          },
        });

        map.current?.addLayer({
          id: `${sourceId}-fill`,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.1,
          },
        });

        map.current?.addLayer({
          id: `${sourceId}-outline`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#3b82f6',
            'line-width': 2,
            'line-opacity': 0.6,
          },
        });
      } catch (e) {
        console.error('Error adding zone layer:', e);
      }
    });

    // Draw major zone centers as circles
    majorZones.forEach((zone) => {
      if (!zone.center_latitude || !zone.center_longitude) return;
      
      const sourceId = `major-zone-${zone.id}`;
      
      if (map.current?.getSource(sourceId)) return;

      try {
        map.current?.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { name: zone.name },
            geometry: {
              type: 'Point',
              coordinates: [zone.center_longitude, zone.center_latitude],
            },
          },
        });

        map.current?.addLayer({
          id: `${sourceId}-circle`,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': 8,
            'circle-color': '#f59e0b',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
      } catch (e) {
        console.error('Error adding major zone layer:', e);
      }
    });
  }, [mapLoaded, zones]);

  // Detect zone when location changes
  useEffect(() => {
    if (!selectedLocation || !zones) {
      setDetectedZone(null);
      return;
    }

    const point: [number, number] = [selectedLocation.lng, selectedLocation.lat];
    
    // Check sub-zones with polygons first
    for (const zone of zones.filter(z => z.zone_type === 'sub')) {
      if (!zone.polygon_coordinates || !Array.isArray(zone.polygon_coordinates)) continue;
      
      if (isPointInPolygon(point, zone.polygon_coordinates as [number, number][])) {
        const parent = zones.find(z => z.id === zone.parent_zone_id);
        setDetectedZone({
          name: zone.name,
          majorZoneId: parent?.id,
          majorZoneName: parent?.name,
        });
        return;
      }
    }

    // Check major zones by radius
    let closestZone: { zone: DeliveryZone; distance: number } | null = null;
    
    for (const zone of zones.filter(z => z.zone_type === 'major')) {
      if (!zone.center_latitude || !zone.center_longitude) continue;
      
      const distance = getDistanceMeters(
        selectedLocation.lat,
        selectedLocation.lng,
        zone.center_latitude,
        zone.center_longitude
      );

      if (zone.radius_meters && distance <= zone.radius_meters) {
        if (!closestZone || distance < closestZone.distance) {
          closestZone = { zone, distance };
        }
      }
    }

    if (closestZone) {
      setDetectedZone({
        name: closestZone.zone.name,
        majorZoneId: closestZone.zone.id,
        majorZoneName: closestZone.zone.name,
      });
    } else {
      setDetectedZone(null);
    }
  }, [selectedLocation, zones]);

  const handleConfirm = () => {
    if (!selectedLocation) return;

    onLocationSelect({
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lng,
      detectedZone: detectedZone?.name,
      detectedMajorZoneId: detectedZone?.majorZoneId,
      detectedMajorZoneName: detectedZone?.majorZoneName,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Set Location for "{customerName}"
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-[400px] relative rounded-lg overflow-hidden border">
          <div ref={mapContainer} className="absolute inset-0" />
          
          {/* Loading state */}
          {(tokenLoading || (!mapLoaded && !mapError && mapToken)) && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {tokenLoading ? 'Loading map configuration...' : 'Initializing map...'}
                </span>
              </div>
            </div>
          )}

          {/* Error state */}
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="flex flex-col items-center gap-3 text-center p-4">
                <AlertTriangle className="h-10 w-10 text-destructive" />
                <div className="space-y-1">
                  <p className="font-medium text-destructive">Map Failed to Load</p>
                  <p className="text-sm text-muted-foreground max-w-xs">{mapError}</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchMapToken}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Instructions overlay - only show when map is loaded */}
          {mapLoaded && !mapError && (
            <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm px-3 py-2 rounded-md text-sm shadow">
              Click on the map to place a pin, or drag the marker to adjust
            </div>
          )}
        </div>

        {/* Location info */}
        <div className="space-y-2 text-sm">
          {selectedLocation ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Coordinates:</span>
                <span className="font-mono">
                  {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                </span>
              </div>
              {detectedZone ? (
                <div className="flex items-center gap-2 text-green-600">
                  <span>✓ Detected Zone:</span>
                  <span className="font-medium">
                    {detectedZone.name}
                    {detectedZone.majorZoneName && detectedZone.majorZoneName !== detectedZone.name && (
                      <span className="text-muted-foreground"> ({detectedZone.majorZoneName})</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="text-amber-600">
                  ⚠ Location is outside defined zones
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground">
              No location selected. Click on the map to place a marker.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedLocation}>
            <MapPin className="mr-2 h-4 w-4" />
            Confirm Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Utility: Check if point is inside polygon (ray casting algorithm)
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

// Utility: Calculate distance between two points in meters (Haversine)
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
