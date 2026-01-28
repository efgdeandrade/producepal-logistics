import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Pencil, Trash2, Package, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";


interface Product {
  id: string;
  code: string;
  name: string;
  pack_size: number;
  supplier_id: string | null;
  consolidation_group: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface ConsolidationGroup {
  name: string;
  supplierId: string;
  supplierName: string;
  packSize: number;
  products: Product[];
}

const ConsolidationGroups = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ConsolidationGroup | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<ConsolidationGroup | null>(null);

  // Form state
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [groupName, setGroupName] = useState("");
  const [packSize, setPackSize] = useState<number | "">("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products-for-consolidation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, code, name, pack_size, supplier_id, consolidation_group")
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-for-consolidation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  // Aggregate consolidation groups
  const consolidationGroups = useMemo(() => {
    const groups: Map<string, ConsolidationGroup> = new Map();

    products.forEach((product) => {
      if (!product.consolidation_group || !product.supplier_id) return;

      const key = `${product.supplier_id}-${product.consolidation_group}-${product.pack_size}`;
      const existing = groups.get(key);

      if (existing) {
        existing.products.push(product);
      } else {
        const supplier = suppliers.find((s) => s.id === product.supplier_id);
        groups.set(key, {
          name: product.consolidation_group,
          supplierId: product.supplier_id,
          supplierName: supplier?.name || "Unknown Supplier",
          packSize: product.pack_size,
          products: [product],
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.supplierName.localeCompare(b.supplierName)
    );
  }, [products, suppliers]);

  // Available products for current form selection
  const availableProducts = useMemo(() => {
    if (!selectedSupplierId) return [];
    
    return products.filter((p) => {
      // Must be from selected supplier
      if (p.supplier_id !== selectedSupplierId) return false;
      
      // If editing, include products already in this group
      if (editingGroup && p.consolidation_group === editingGroup.name) {
        return true;
      }
      
      // Only show products without a consolidation group or matching pack size
      if (p.consolidation_group && p.consolidation_group !== editingGroup?.name) {
        return false;
      }
      
      // If pack size is set, filter by matching pack size
      if (packSize && p.pack_size !== packSize) return false;
      
      return true;
    });
  }, [products, selectedSupplierId, packSize, editingGroup]);

  // Update products mutation
  const updateProductsMutation = useMutation({
    mutationFn: async ({
      productIds,
      consolidationGroup,
    }: {
      productIds: string[];
      consolidationGroup: string | null;
    }) => {
      const { error } = await supabase
        .from("products")
        .update({ consolidation_group: consolidationGroup })
        .in("id", productIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-for-consolidation"] });
    },
  });

  const formatGroupName = (value: string) => {
    return value
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_")
      .replace(/_+/g, "_");
  };

  const resetForm = () => {
    setSelectedSupplierId("");
    setGroupName("");
    setPackSize("");
    setSelectedProductIds([]);
    setEditingGroup(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (group: ConsolidationGroup) => {
    setEditingGroup(group);
    setSelectedSupplierId(group.supplierId);
    setGroupName(group.name);
    setPackSize(group.packSize);
    setSelectedProductIds(group.products.map((p) => p.id));
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!groupName || !selectedSupplierId || selectedProductIds.length === 0) {
      toast.error("Please fill in all required fields and select at least one product");
      return;
    }

    try {
      // If editing, first clear old products that are being removed
      if (editingGroup) {
        const oldProductIds = editingGroup.products.map((p) => p.id);
        const removedProductIds = oldProductIds.filter(
          (id) => !selectedProductIds.includes(id)
        );
        if (removedProductIds.length > 0) {
          await updateProductsMutation.mutateAsync({
            productIds: removedProductIds,
            consolidationGroup: null,
          });
        }
      }

      // Set consolidation group on selected products
      await updateProductsMutation.mutateAsync({
        productIds: selectedProductIds,
        consolidationGroup: groupName,
      });

      toast.success(
        editingGroup
          ? "Consolidation group updated"
          : "Consolidation group created"
      );
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to save consolidation group");
    }
  };

  const handleDelete = async () => {
    if (!deleteGroup) return;

    try {
      const productIds = deleteGroup.products.map((p) => p.id);
      await updateProductsMutation.mutateAsync({
        productIds,
        consolidationGroup: null,
      });
      toast.success("Consolidation group deleted");
      setDeleteGroup(null);
    } catch (error) {
      toast.error("Failed to delete consolidation group");
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  if (productsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/import/products">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Products
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Layers className="h-6 w-6" />
                Consolidation Groups
              </h1>
              <p className="text-muted-foreground text-sm">
                Manage product groupings for combined case ordering
              </p>
            </div>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Group
          </Button>
        </div>

        {consolidationGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Consolidation Groups</h3>
              <p className="text-muted-foreground mb-4">
                Create groups to combine products from the same supplier into shared cases.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Group
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {consolidationGroups.map((group) => (
              <Card key={`${group.supplierId}-${group.name}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg font-mono">
                        {group.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {group.supplierName}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {group.packSize} units/case
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium">
                      {group.products.length} product{group.products.length !== 1 ? "s" : ""}:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                      {group.products.map((product) => (
                        <li key={product.id} className="truncate">
                          • {product.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(group)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-destructive hover:text-destructive"
                      onClick={() => setDeleteGroup(group)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? "Edit Consolidation Group" : "Create Consolidation Group"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier *</Label>
                <Select
                  value={selectedSupplierId}
                  onValueChange={(value) => {
                    setSelectedSupplierId(value);
                    setSelectedProductIds([]);
                  }}
                  disabled={!!editingGroup}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="groupName">Group Name *</Label>
                <Input
                  id="groupName"
                  value={groupName}
                  onChange={(e) => setGroupName(formatGroupName(e.target.value))}
                  placeholder="e.g., BABY_GREENS_150G"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-formatted to UPPERCASE_SNAKE_CASE
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="packSize">Pack Size (units per case) *</Label>
                <Input
                  id="packSize"
                  type="number"
                  value={packSize}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : "";
                    setPackSize(val);
                    setSelectedProductIds([]);
                  }}
                  placeholder="e.g., 18"
                  disabled={!!editingGroup}
                />
                <p className="text-xs text-muted-foreground">
                  Products must have matching pack size
                </p>
              </div>

              {selectedSupplierId && (
                <div className="space-y-2">
                  <Label>Select Products</Label>
                  {availableProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                      No matching products found.
                      {packSize ? " Try a different pack size." : ""}
                    </p>
                  ) : (
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {availableProducts.map((product) => (
                        <label
                          key={product.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                        >
                          <Checkbox
                            checked={selectedProductIds.includes(product.id)}
                            onCheckedChange={() => toggleProduct(product.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.code} • Pack: {product.pack_size}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {selectedProductIds.length} product{selectedProductIds.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !groupName ||
                  !selectedSupplierId ||
                  selectedProductIds.length === 0 ||
                  updateProductsMutation.isPending
                }
              >
                {updateProductsMutation.isPending ? "Saving..." : "Save Group"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteGroup} onOpenChange={() => setDeleteGroup(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Consolidation Group?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the consolidation group "{deleteGroup?.name}" and
                ungroup {deleteGroup?.products.length} product{deleteGroup?.products.length !== 1 ? "s" : ""}.
                The products will remain in the system but won't be consolidated for ordering.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Group
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
};

export default ConsolidationGroups;
