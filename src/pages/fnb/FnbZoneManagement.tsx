import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, Users, GripVertical, ArrowUp, ArrowDown, Map, List, Crown, ChevronDown, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ZoneHierarchyMapView from "@/components/fnb/ZoneHierarchyMapView";
import ZoneDrawingDialogV2 from "@/components/fnb/ZoneDrawingDialogV2";
import { cn } from "@/lib/utils";

// Cast the backend client to `any` in this page to avoid excessively-deep type instantiation errors
// from complex nested selects (keeps runtime behavior the same).
const supabase = supabaseClient as any;

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

const emptyZone = {
  name: "",
  description: "",
  sort_order: 0,
  is_active: true,
};

export default function FnbZoneManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [formData, setFormData] = useState(emptyZone);
  const [expandedMajorZones, setExpandedMajorZones] = useState<Set<string>>(new Set());

  // Fetch zones with customer counts
  const { data: zones, isLoading } = useQuery({
    queryKey: ["fnb-delivery-zones"],
    queryFn: async () => {
      const { data: zonesData, error: zonesError } = await supabase
        .from("distribution_delivery_zones")
        .select("*")
        .order("sort_order", { ascending: true });
      if (zonesError) throw zonesError;

      // Get customer counts per zone
      const { data: customers, error: customersError } = await supabase
        .from("distribution_customers")
        .select("delivery_zone");
      if (customersError) throw customersError;

      const zoneCounts: Record<string, number> = {};
      customers?.forEach((c) => {
        if (c.delivery_zone) {
          zoneCounts[c.delivery_zone] = (zoneCounts[c.delivery_zone] || 0) + 1;
        }
      });

      return zonesData?.map((zone) => ({
        ...zone,
        zone_type: (zone.zone_type as "major" | "sub") || "sub",
        polygon_coordinates: zone.polygon_coordinates as [number, number][] | null,
        customer_count: zoneCounts[zone.name] || 0,
      })) as Zone[];
    },
  });

  // Fetch customers for map view
  const { data: customers } = useQuery({
    queryKey: ["fnb-customers-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_customers")
        .select("id, name, latitude, longitude, delivery_zone");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      is_active: boolean;
      zone_type: "major" | "sub";
      parent_zone_id: string | null;
      center_latitude: number | null;
      center_longitude: number | null;
      radius_meters: number | null;
      polygon_coordinates: [number, number][] | null;
    }) => {
      const maxOrder = zones?.reduce((max, z) => Math.max(max, z.sort_order), 0) || 0;
      const { error } = await supabase.from("distribution_delivery_zones").insert({
        name: data.name,
        description: data.description || null,
        sort_order: maxOrder + 1,
        is_active: data.is_active,
        zone_type: data.zone_type,
        parent_zone_id: data.parent_zone_id,
        center_latitude: data.center_latitude,
        center_longitude: data.center_longitude,
        radius_meters: data.radius_meters,
        polygon_coordinates: data.polygon_coordinates,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zone created successfully");
      queryClient.invalidateQueries({ queryKey: ["fnb-delivery-zones"] });
      resetForm();
      setMapDialogOpen(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("A zone with this name already exists");
      } else {
        toast.error("Failed to create zone: " + error.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Zone> }) => {
      const { error } = await supabase.from("distribution_delivery_zones").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zone updated successfully");
      queryClient.invalidateQueries({ queryKey: ["fnb-delivery-zones"] });
      resetForm();
      setMapDialogOpen(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("A zone with this name already exists");
      } else {
        toast.error("Failed to update zone: " + error.message);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("distribution_delivery_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zone deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["fnb-delivery-zones"] });
      setDeleteDialogOpen(false);
      setZoneToDelete(null);
    },
    onError: (error) => {
      toast.error("Failed to delete zone: " + error.message);
    },
  });

  const moveZone = async (zone: Zone, direction: "up" | "down") => {
    if (!zones) return;
    const currentIndex = zones.findIndex((z) => z.id === zone.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= zones.length) return;

    const targetZone = zones[targetIndex];
    const tempOrder = zone.sort_order;

    await Promise.all([
      supabase.from("distribution_delivery_zones").update({ sort_order: targetZone.sort_order }).eq("id", zone.id),
      supabase.from("distribution_delivery_zones").update({ sort_order: tempOrder }).eq("id", targetZone.id),
    ]);

    queryClient.invalidateQueries({ queryKey: ["fnb-delivery-zones"] });
  };

  const resetForm = () => {
    setDialogOpen(false);
    setEditingZone(null);
    setFormData(emptyZone);
  };

  const handleEdit = (zone: Zone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      description: zone.description || "",
      sort_order: zone.sort_order,
      is_active: zone.is_active,
    });
    setDialogOpen(true);
  };

  const handleEditOnMap = (zone: Zone) => {
    setEditingZone(zone);
    setMapDialogOpen(true);
  };

  const handleDelete = (zone: Zone) => {
    setZoneToDelete(zone);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Zone name is required");
      return;
    }
    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, data: formData });
    } else {
      createMutation.mutate({
        ...formData,
        zone_type: "sub",
        parent_zone_id: null,
        center_latitude: null,
        center_longitude: null,
        radius_meters: 1000,
        polygon_coordinates: null,
      });
    }
  };

  const handleMapSave = async (data: {
    name: string;
    description: string;
    is_active: boolean;
    zone_type: "major" | "sub";
    parent_zone_id: string | null;
    center_latitude: number | null;
    center_longitude: number | null;
    radius_meters: number | null;
    polygon_coordinates: [number, number][] | null;
    assigned_sub_zone_ids?: string[];
  }) => {
    if (editingZone) {
      // Update the zone first
      await updateMutation.mutateAsync({
        id: editingZone.id,
        data: {
          name: data.name,
          description: data.description || null,
          is_active: data.is_active,
          zone_type: data.zone_type,
          parent_zone_id: data.parent_zone_id,
          center_latitude: data.center_latitude,
          center_longitude: data.center_longitude,
          radius_meters: data.radius_meters,
          polygon_coordinates: data.polygon_coordinates,
        },
      });

      // If it's a major zone and we have sub-zone assignments, update them
      if (data.zone_type === "major" && data.assigned_sub_zone_ids !== undefined) {
        const currentSubZones = zones?.filter((z) => z.zone_type === "sub") || [];
        
        // Find sub-zones that need to be assigned to this major zone
        const toAssign = data.assigned_sub_zone_ids;
        
        // Find sub-zones that were previously assigned but are now unassigned
        const previouslyAssigned = currentSubZones
          .filter((sz) => sz.parent_zone_id === editingZone.id)
          .map((sz) => sz.id);
        
        const toUnassign = previouslyAssigned.filter((id) => !toAssign.includes(id));
        const newlyAssigned = toAssign.filter((id) => !previouslyAssigned.includes(id));

        // Update sub-zones that need to be assigned to this major zone
        if (newlyAssigned.length > 0) {
          await supabase
            .from("distribution_delivery_zones")
            .update({ parent_zone_id: editingZone.id })
            .in("id", newlyAssigned);
        }

        // Update sub-zones that need to be unassigned
        if (toUnassign.length > 0) {
          await supabase
            .from("distribution_delivery_zones")
            .update({ parent_zone_id: null })
            .in("id", toUnassign);
        }

        // Invalidate queries to refresh the data
        queryClient.invalidateQueries({ queryKey: ["fnb-delivery-zones"] });
        toast.success(`Zone updated with ${toAssign.length} sub-zones assigned`);
      }
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleActive = (zone: Zone) => {
    updateMutation.mutate({ id: zone.id, data: { is_active: !zone.is_active } });
  };

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

  const majorZones = zones?.filter((z) => z.zone_type === "major") || [];
  const subZones = zones?.filter((z) => z.zone_type === "sub") || [];
  const unassignedSubZones = subZones.filter((z) => !z.parent_zone_id);
  const activeZones = zones?.filter((z) => z.is_active) || [];
  const inactiveZones = zones?.filter((z) => !z.is_active) || [];

  const getSubZonesForMajor = (majorZoneId: string) => {
    return subZones.filter((z) => z.parent_zone_id === majorZoneId);
  };

  const getZoneTypeColor = (zone: Zone) => {
    if (zone.zone_type === "major") {
      return zone.name === "Pariba" ? "bg-blue-500" : zone.name === "Pabou" ? "bg-green-500" : "bg-amber-500";
    }
    return "bg-muted";
  };

  const renderZoneRow = (zone: Zone, index: number, isChild = false) => (
    <div
      key={zone.id}
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border",
        zone.is_active ? "bg-card" : "bg-muted/50 opacity-60",
        isChild && "ml-8 border-l-4",
        isChild && zone.parent_zone_id && zones?.find((z) => z.id === zone.parent_zone_id)?.name === "Pariba" && "border-l-blue-500",
        isChild && zone.parent_zone_id && zones?.find((z) => z.id === zone.parent_zone_id)?.name === "Pabou" && "border-l-green-500",
        isChild && zone.parent_zone_id && zones?.find((z) => z.id === zone.parent_zone_id)?.name === "Meimei" && "border-l-amber-500"
      )}
    >
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={index === 0}
          onClick={() => moveZone(zone, "up")}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={index === (zones?.length || 0) - 1}
          onClick={() => moveZone(zone, "down")}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>
      <GripVertical className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {zone.zone_type === "major" && (
            <Crown className="h-4 w-4 text-amber-500" />
          )}
          <span className="font-medium">{zone.name}</span>
          {zone.zone_type === "major" && (
            <Badge className="bg-primary/20 text-primary text-xs">Major</Badge>
          )}
          {!zone.is_active && (
            <Badge variant="secondary" className="text-xs">Inactive</Badge>
          )}
          {(zone.polygon_coordinates || (zone.center_latitude && zone.center_longitude)) && (
            <Badge variant="outline" className="text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              {zone.polygon_coordinates ? "Polygon" : "Circle"}
            </Badge>
          )}
        </div>
        {zone.description && (
          <p className="text-sm text-muted-foreground">{zone.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {zone.customer_count} customers
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={zone.is_active}
          onCheckedChange={() => toggleActive(zone)}
          aria-label="Toggle zone active status"
        />
        <Button variant="ghost" size="icon" onClick={() => handleEditOnMap(zone)}>
          <Map className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleEdit(zone)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleDelete(zone)}
          disabled={(zone.customer_count || 0) > 0 || (zone.zone_type === "major" && getSubZonesForMajor(zone.id).length > 0)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/fnb")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Zone Management</h1>
            <p className="text-muted-foreground">Manage delivery zones with major zones (Pariba, Pabou, Meimei) and sub-zones</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none"
            >
              <List className="h-4 w-4 mr-2" />
              List
            </Button>
            <Button
              variant={viewMode === "map" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("map")}
              className="rounded-none"
            >
              <Map className="h-4 w-4 mr-2" />
              Map
            </Button>
          </div>
          <Button
            onClick={() => {
              setEditingZone(null);
              setMapDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Zone
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{majorZones.length}</div>
            <div className="text-sm text-muted-foreground">Major Zones</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{subZones.length}</div>
            <div className="text-sm text-muted-foreground">Sub Zones</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{activeZones.length}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{unassignedSubZones.length}</div>
            <div className="text-sm text-muted-foreground">Unassigned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {zones?.reduce((sum, z) => sum + (z.customer_count || 0), 0) || 0}
            </div>
            <div className="text-sm text-muted-foreground">Total Customers</div>
          </CardContent>
        </Card>
      </div>

      {viewMode === "map" ? (
        /* Map View */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Zone Map - Curaçao
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[600px]">
            <ZoneHierarchyMapView
              zones={zones || []}
              customers={customers || []}
              selectedZone={selectedZone}
              onZoneSelect={(zone) => {
                setSelectedZone(zone);
                if (zone) {
                  handleEditOnMap(zone);
                }
              }}
            />
          </CardContent>
        </Card>
      ) : (
        /* Hierarchical List View */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Delivery Zones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading zones...</p>
            ) : zones?.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No zones configured. Start by creating the 3 major zones.</p>
                <div className="flex gap-2 justify-center">
                  {["Pariba", "Pabou", "Meimei"].map((name) => (
                    <Button
                      key={name}
                      variant="outline"
                      onClick={() => {
                        setEditingZone(null);
                        setMapDialogOpen(true);
                      }}
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Create {name}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Major Zones with their sub-zones */}
                {majorZones.map((major, majorIndex) => {
                  const children = getSubZonesForMajor(major.id);
                  const isExpanded = expandedMajorZones.has(major.id);

                  return (
                    <div key={major.id}>
                      {/* Major Zone Row with expand toggle */}
                      <div
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-lg border-2",
                          major.is_active ? "bg-card" : "bg-muted/50 opacity-60",
                          major.name === "Pariba" && "border-blue-500/50",
                          major.name === "Pabou" && "border-green-500/50",
                          major.name === "Meimei" && "border-amber-500/50"
                        )}
                      >
                        {children.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleMajorZone(major.id)}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        )}
                        <Crown className={cn(
                          "h-5 w-5",
                          major.name === "Pariba" && "text-blue-500",
                          major.name === "Pabou" && "text-green-500",
                          major.name === "Meimei" && "text-amber-500"
                        )} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{major.name}</span>
                            <Badge className="bg-primary/20 text-primary text-xs">Major Zone</Badge>
                            {!major.is_active && (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                          {major.description && (
                            <p className="text-sm text-muted-foreground">{major.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {children.length} sub-zones
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {major.customer_count} direct + {children.reduce((sum, c) => sum + (c.customer_count || 0), 0)} in sub-zones
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={major.is_active}
                            onCheckedChange={() => toggleActive(major)}
                          />
                          <Button variant="ghost" size="icon" onClick={() => handleEditOnMap(major)}>
                            <Map className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(major)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(major)}
                            disabled={(major.customer_count || 0) > 0 || children.length > 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Sub-zones */}
                      {isExpanded && children.length > 0 && (
                        <div className="ml-8 mt-2 space-y-2">
                          {children.map((sub, subIndex) => renderZoneRow(sub, subIndex, true))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Unassigned Sub-zones */}
                {unassignedSubZones.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium mb-2 text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Unassigned Sub-zones ({unassignedSubZones.length})
                    </h3>
                    <div className="space-y-2">
                      {unassignedSubZones.map((zone, index) => renderZoneRow(zone, index))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Map Drawing Dialog V2 */}
      <ZoneDrawingDialogV2
        open={mapDialogOpen}
        onOpenChange={(open) => {
          setMapDialogOpen(open);
          if (!open) {
            setEditingZone(null);
          }
        }}
        zone={editingZone}
        zones={zones || []}
        customers={customers || []}
        onSave={handleMapSave}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Simple Add/Edit Dialog (for quick edits without map) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingZone ? "Edit Zone" : "Add New Zone"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Zone Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Willemstad"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingZone ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zone</AlertDialogTitle>
            <AlertDialogDescription>
              {zoneToDelete?.customer_count && zoneToDelete.customer_count > 0 ? (
                <>
                  Cannot delete "{zoneToDelete?.name}" because it has {zoneToDelete?.customer_count}{" "}
                  customer(s) assigned to it. Please reassign customers before deleting.
                </>
              ) : zoneToDelete?.zone_type === "major" && getSubZonesForMajor(zoneToDelete.id).length > 0 ? (
                <>
                  Cannot delete "{zoneToDelete?.name}" because it has sub-zones. 
                  Please reassign or delete sub-zones first.
                </>
              ) : (
                <>
                  Are you sure you want to delete "{zoneToDelete?.name}"? This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {(!zoneToDelete?.customer_count || zoneToDelete.customer_count === 0) && 
             (zoneToDelete?.zone_type !== "major" || getSubZonesForMajor(zoneToDelete?.id || "").length === 0) && (
              <AlertDialogAction
                onClick={() => zoneToDelete && deleteMutation.mutate(zoneToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
