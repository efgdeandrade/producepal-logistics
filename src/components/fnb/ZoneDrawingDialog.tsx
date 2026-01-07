import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MapPin, Target, Ruler } from "lucide-react";
import ZoneMapView from "./ZoneMapView";

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

interface ZoneDrawingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone: Zone | null;
  zones: Zone[];
  customers: Customer[];
  onSave: (data: {
    name: string;
    description: string;
    is_active: boolean;
    center_latitude: number | null;
    center_longitude: number | null;
    radius_meters: number;
  }) => void;
  isPending?: boolean;
}

export default function ZoneDrawingDialog({
  open,
  onOpenChange,
  zone,
  zones,
  customers,
  onSave,
  isPending = false,
}: ZoneDrawingDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [centerLat, setCenterLat] = useState<number | null>(null);
  const [centerLng, setCenterLng] = useState<number | null>(null);
  const [radius, setRadius] = useState(1000);

  // Reset form when dialog opens/closes or zone changes
  useEffect(() => {
    if (open) {
      if (zone) {
        setName(zone.name);
        setDescription(zone.description || "");
        setIsActive(zone.is_active);
        setCenterLat(zone.center_latitude || null);
        setCenterLng(zone.center_longitude || null);
        setRadius(zone.radius_meters || 1000);
      } else {
        setName("");
        setDescription("");
        setIsActive(true);
        setCenterLat(null);
        setCenterLng(null);
        setRadius(1000);
      }
    }
  }, [open, zone]);

  const handleMapClick = (lng: number, lat: number) => {
    setCenterLng(lng);
    setCenterLat(lat);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Zone name is required");
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      is_active: isActive,
      center_latitude: centerLat,
      center_longitude: centerLng,
      radius_meters: radius,
    });
  };

  // Calculate customers within the drawn zone
  const customersInZone = customers.filter((customer) => {
    if (!customer.latitude || !customer.longitude || !centerLat || !centerLng) {
      return false;
    }
    const distance = getDistanceFromLatLonInMeters(
      centerLat,
      centerLng,
      customer.latitude,
      customer.longitude
    );
    return distance <= radius;
  });

  // Other zones (excluding current one being edited)
  const otherZones = zone ? zones.filter((z) => z.id !== zone.id) : zones;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {zone ? "Edit Zone" : "Create Zone"} - Map View
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
          {/* Map */}
          <div className="lg:col-span-2 min-h-[400px] rounded-lg overflow-hidden border">
            <ZoneMapView
              zones={otherZones}
              customers={customers}
              selectedZone={null}
              onZoneSelect={() => {}}
              onMapClick={handleMapClick}
              isDrawingMode={true}
              drawingCenter={centerLat && centerLng ? { lng: centerLng, lat: centerLat } : null}
              drawingRadius={radius}
            />
          </div>

          {/* Form */}
          <div className="space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="zone-name">Zone Name *</Label>
              <Input
                id="zone-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Willemstad"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zone-description">Description</Label>
              <Input
                id="zone-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="zone-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="zone-active">Active</Label>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Zone Location
              </h4>

              {centerLat && centerLng ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Latitude</Label>
                      <Input
                        value={centerLat.toFixed(6)}
                        readOnly
                        className="text-sm font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Longitude</Label>
                      <Input
                        value={centerLng.toFixed(6)}
                        readOnly
                        className="text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Ruler className="h-4 w-4" />
                        Radius
                      </Label>
                      <span className="text-sm font-medium">
                        {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}
                      </span>
                    </div>
                    <Slider
                      value={[radius]}
                      onValueChange={([value]) => setRadius(value)}
                      min={100}
                      max={5000}
                      step={100}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>100m</span>
                      <span>5km</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCenterLat(null);
                      setCenterLng(null);
                    }}
                    className="w-full"
                  >
                    Clear Location
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click on the map to set<br />the zone center
                  </p>
                </div>
              )}
            </div>

            {/* Customers in zone preview */}
            {centerLat && centerLng && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2 text-sm">
                  Customers in Zone: {customersInZone.length}
                </h4>
                {customersInZone.length > 0 ? (
                  <div className="max-h-[120px] overflow-y-auto space-y-1">
                    {customersInZone.slice(0, 10).map((customer) => (
                      <div
                        key={customer.id}
                        className="text-xs bg-muted px-2 py-1 rounded"
                      >
                        {customer.name}
                      </div>
                    ))}
                    {customersInZone.length > 10 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{customersInZone.length - 10} more
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No customers with coordinates in this zone
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving..." : zone ? "Update Zone" : "Create Zone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Calculate distance between two coordinates in meters
function getDistanceFromLatLonInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of the earth in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
