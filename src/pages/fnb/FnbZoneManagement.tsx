import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, Users, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Zone {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  customer_count?: number;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);
  const [formData, setFormData] = useState(emptyZone);

  // Fetch zones with customer counts
  const { data: zones, isLoading } = useQuery({
    queryKey: ["fnb-delivery-zones"],
    queryFn: async () => {
      const { data: zonesData, error: zonesError } = await supabase
        .from("fnb_delivery_zones")
        .select("*")
        .order("sort_order", { ascending: true });
      if (zonesError) throw zonesError;

      // Get customer counts per zone
      const { data: customers, error: customersError } = await supabase
        .from("fnb_customers")
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
        customer_count: zoneCounts[zone.name] || 0,
      })) as Zone[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyZone) => {
      const maxOrder = zones?.reduce((max, z) => Math.max(max, z.sort_order), 0) || 0;
      const { error } = await supabase.from("fnb_delivery_zones").insert({
        name: data.name,
        description: data.description || null,
        sort_order: maxOrder + 1,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zone created successfully");
      queryClient.invalidateQueries({ queryKey: ["fnb-delivery-zones"] });
      resetForm();
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
      const { error } = await supabase.from("fnb_delivery_zones").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zone updated successfully");
      queryClient.invalidateQueries({ queryKey: ["fnb-delivery-zones"] });
      resetForm();
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
      const { error } = await supabase.from("fnb_delivery_zones").delete().eq("id", id);
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
      supabase.from("fnb_delivery_zones").update({ sort_order: targetZone.sort_order }).eq("id", zone.id),
      supabase.from("fnb_delivery_zones").update({ sort_order: tempOrder }).eq("id", targetZone.id),
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
      createMutation.mutate(formData);
    }
  };

  const toggleActive = (zone: Zone) => {
    updateMutation.mutate({ id: zone.id, data: { is_active: !zone.is_active } });
  };

  const activeZones = zones?.filter((z) => z.is_active) || [];
  const inactiveZones = zones?.filter((z) => !z.is_active) || [];

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/fnb")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Zone Management</h1>
            <p className="text-muted-foreground">Manage delivery zones for F&B customers</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Zone
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{zones?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Total Zones</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{activeZones.length}</div>
            <div className="text-sm text-muted-foreground">Active Zones</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{inactiveZones.length}</div>
            <div className="text-sm text-muted-foreground">Inactive Zones</div>
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

      {/* Zones List */}
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
            <p className="text-center py-8 text-muted-foreground">No zones configured</p>
          ) : (
            <div className="space-y-2">
              {zones?.map((zone, index) => (
                <div
                  key={zone.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    zone.is_active ? "bg-card" : "bg-muted/50 opacity-60"
                  }`}
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
                      disabled={index === zones.length - 1}
                      onClick={() => moveZone(zone, "down")}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{zone.name}</span>
                      {!zone.is_active && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
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
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(zone)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(zone)}
                      disabled={(zone.customer_count || 0) > 0}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
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
              ) : (
                <>
                  Are you sure you want to delete "{zoneToDelete?.name}"? This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {(!zoneToDelete?.customer_count || zoneToDelete.customer_count === 0) && (
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
