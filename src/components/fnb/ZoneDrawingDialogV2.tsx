import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MapPin, Circle, Pentagon, Crown } from "lucide-react";
import PolygonDrawingMap from "./PolygonDrawingMap";
import ZoneMapView from "./ZoneMapView";

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

interface ZoneDrawingDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone: Zone | null;
  zones: Zone[];
  customers: Customer[];
  onSave: (data: {
    name: string;
    description: string;
    is_active: boolean;
    zone_type: "major" | "sub";
    parent_zone_id: string | null;
    center_latitude: number | null;
    center_longitude: number | null;
    radius_meters: number | null;
    polygon_coordinates: [number, number][] | null;
  }) => void;
  isPending?: boolean;
}

export default function ZoneDrawingDialogV2({
  open,
  onOpenChange,
  zone,
  zones,
  customers,
  onSave,
  isPending = false,
}: ZoneDrawingDialogV2Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [zoneType, setZoneType] = useState<"major" | "sub">("sub");
  const [parentZoneId, setParentZoneId] = useState<string | null>(null);
  const [drawingMode, setDrawingMode] = useState<"circle" | "polygon">("polygon");
  
  // Circle mode state
  const [centerLat, setCenterLat] = useState<number | null>(null);
  const [centerLng, setCenterLng] = useState<number | null>(null);
  const [radius, setRadius] = useState(1000);
  
  // Polygon mode state
  const [polygonCoords, setPolygonCoords] = useState<[number, number][] | null>(null);

  const majorZones = zones.filter((z) => z.zone_type === "major");

  // Generate distinct colors for major zones
  const getMajorZoneColor = (zoneName: string): string => {
    const name = zoneName.toLowerCase().trim();
    if (name.includes("pariba")) return "#3b82f6"; // Blue
    if (name.includes("pabou")) return "#22c55e"; // Green
    if (name.includes("meimei")) return "#f59e0b"; // Amber
    // Generate color from name hash for other zones
    const colors = ["#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4"];
    const hash = zoneName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Reset form when dialog opens/closes or zone changes
  useEffect(() => {
    if (open) {
      if (zone) {
        setName(zone.name);
        setDescription(zone.description || "");
        setIsActive(zone.is_active);
        setZoneType(zone.zone_type || "sub");
        setParentZoneId(zone.parent_zone_id);
        setCenterLat(zone.center_latitude || null);
        setCenterLng(zone.center_longitude || null);
        setRadius(zone.radius_meters || 1000);
        
        // Determine drawing mode based on existing data
        if (zone.polygon_coordinates && zone.polygon_coordinates.length >= 3) {
          setDrawingMode("polygon");
          setPolygonCoords(zone.polygon_coordinates);
        } else if (zone.center_latitude && zone.center_longitude) {
          setDrawingMode("circle");
          setPolygonCoords(null);
        } else {
          setDrawingMode("polygon");
          setPolygonCoords(null);
        }
      } else {
        // Reset for new zone
        setName("");
        setDescription("");
        setIsActive(true);
        setZoneType("sub");
        setParentZoneId(null);
        setDrawingMode("polygon");
        setCenterLat(null);
        setCenterLng(null);
        setRadius(1000);
        setPolygonCoords(null);
      }
    }
  }, [open, zone]);

  const handleMapClick = (lng: number, lat: number) => {
    if (drawingMode === "circle") {
      setCenterLng(lng);
      setCenterLat(lat);
    }
  };

  const handlePolygonChange = useCallback((coords: [number, number][] | null) => {
    setPolygonCoords(coords);
  }, []);

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Zone name is required");
      return;
    }

    // Validate that sub-zones have a parent for better organization
    if (zoneType === "sub" && !parentZoneId && majorZones.length > 0) {
      // Allow unassigned sub-zones but show warning
      console.log("Creating sub-zone without parent");
    }

    const saveData = {
      name: name.trim(),
      description: description.trim(),
      is_active: isActive,
      zone_type: zoneType,
      parent_zone_id: zoneType === "major" ? null : parentZoneId,
      center_latitude: drawingMode === "circle" ? centerLat : null,
      center_longitude: drawingMode === "circle" ? centerLng : null,
      radius_meters: drawingMode === "circle" ? radius : null,
      polygon_coordinates: drawingMode === "polygon" ? polygonCoords : null,
    };

    onSave(saveData);
  };

  // Other zones for display (excluding current)
  const otherZones = zone ? zones.filter((z) => z.id !== zone.id) : zones;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {zone ? "Edit Zone" : "Create Zone"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
          {/* Map */}
          <div className="lg:col-span-2 min-h-[400px] rounded-lg overflow-hidden border">
            {drawingMode === "polygon" ? (
              <PolygonDrawingMap
                key={zone?.id || "new-zone"}
                initialPolygon={polygonCoords}
                customers={customers}
                onPolygonChange={handlePolygonChange}
                zoneColor={zoneType === "major" ? getMajorZoneColor(name) : "#22c55e"}
              />
            ) : (
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
            )}
          </div>

          {/* Form */}
          <div className="space-y-4 overflow-y-auto">
            {/* Zone Type */}
            <div className="space-y-2">
              <Label>Zone Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={zoneType === "major" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setZoneType("major")}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Major Zone
                </Button>
                <Button
                  type="button"
                  variant={zoneType === "sub" ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setZoneType("sub")}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Sub Zone
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {zoneType === "major" 
                  ? "Major zones (Pariba, Pabou, Meimei) are primary delivery regions"
                  : "Sub zones are neighborhoods within major zones"}
              </p>
            </div>

            {/* Parent Zone (for sub-zones) */}
            {zoneType === "sub" && majorZones.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="parent-zone">Parent Major Zone</Label>
                <Select
                  value={parentZoneId || "none"}
                  onValueChange={(val) => setParentZoneId(val === "none" ? null : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent (standalone)</SelectItem>
                    {majorZones.map((mz) => (
                      <SelectItem key={mz.id} value={mz.id}>
                        {mz.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="zone-name">Zone Name *</Label>
              <Input
                id="zone-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={zoneType === "major" ? "e.g., Pariba" : "e.g., Santa Rosa"}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="zone-description">Description</Label>
              <Input
                id="zone-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="zone-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="zone-active">Active</Label>
            </div>

            {/* Drawing Mode */}
            <div className="border-t pt-4 mt-4">
              <Label className="mb-2 block">Drawing Mode</Label>
              <Tabs value={drawingMode} onValueChange={(v) => setDrawingMode(v as "circle" | "polygon")}>
                <TabsList className="w-full">
                  <TabsTrigger value="polygon" className="flex-1">
                    <Pentagon className="h-4 w-4 mr-2" />
                    Polygon
                  </TabsTrigger>
                  <TabsTrigger value="circle" className="flex-1">
                    <Circle className="h-4 w-4 mr-2" />
                    Circle
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="circle" className="space-y-3 mt-3">
                  {centerLat && centerLng ? (
                    <>
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
                          <Label>Radius</Label>
                          <span className="text-sm font-medium">
                            {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={100}
                          max={5000}
                          step={100}
                          value={radius}
                          onChange={(e) => setRadius(Number(e.target.value))}
                          className="w-full"
                        />
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
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Click on the map to set center point
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="polygon" className="mt-3">
                  <p className="text-sm text-muted-foreground">
                    {polygonCoords && polygonCoords.length >= 3
                      ? `Polygon with ${polygonCoords.length} vertices`
                      : "Click on the map to draw polygon vertices"}
                  </p>
                </TabsContent>
              </Tabs>
            </div>
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
