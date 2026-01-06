import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AlertCircle, CheckCircle, SkipForward, Inbox } from "lucide-react";
import { toast } from "sonner";

export function UnmatchedItemsQueue() {
  const queryClient = useQueryClient();
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string>>({});
  const [addAsGlobal, setAddAsGlobal] = useState<Record<string, boolean>>({});

  // Fetch unmatched items
  const { data: unmatchedItems = [], isLoading } = useQuery({
    queryKey: ["fnb-unmatched-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fnb_unmatched_items")
        .select(`
          id,
          raw_text,
          customer_id,
          detected_language,
          detected_quantity,
          detected_unit,
          created_at,
          fnb_customers (id, name)
        `)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch products for dropdown
  const { data: products = [] } = useQuery({
    queryKey: ["fnb-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fnb_products")
        .select("id, code, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Resolve item mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ itemId, productId, asGlobal }: { itemId: string; productId: string; asGlobal: boolean }) => {
      const item = unmatchedItems.find((i) => i.id === itemId);
      if (!item) throw new Error("Item not found");

      // Update the unmatched item as resolved
      const { error: updateError } = await supabase
        .from("fnb_unmatched_items")
        .update({
          is_resolved: true,
          resolved_product_id: productId,
          resolved_at: new Date().toISOString(),
          added_as_global_alias: asGlobal,
        })
        .eq("id", itemId);

      if (updateError) throw updateError;

      if (asGlobal) {
        // Add as global alias
        const { error: aliasError } = await supabase.from("fnb_product_aliases").insert({
          alias: item.raw_text.toLowerCase().trim(),
          language: item.detected_language || "en",
          product_id: productId,
          confidence_score: 1.0,
        });
        if (aliasError && !aliasError.message.includes("duplicate")) {
          console.warn("Could not add global alias:", aliasError);
        }
      } else if (item.customer_id) {
        // Add as customer-specific mapping
        const { error: mappingError } = await supabase.from("fnb_customer_product_mappings").upsert({
          customer_id: item.customer_id,
          customer_sku: item.raw_text.toLowerCase().trim(),
          customer_product_name: item.raw_text,
          product_id: productId,
          is_verified: true,
          confidence_score: 1.0,
        }, {
          onConflict: "customer_id,customer_sku",
        });
        if (mappingError) {
          console.warn("Could not add customer mapping:", mappingError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fnb-unmatched-items"] });
      queryClient.invalidateQueries({ queryKey: ["fnb-product-aliases"] });
      queryClient.invalidateQueries({ queryKey: ["fnb-customer-mappings"] });
      toast.success("Item resolved and learned!");
    },
    onError: (error) => {
      toast.error(`Failed to resolve: ${error.message}`);
    },
  });

  // Skip item mutation
  const skipMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("fnb_unmatched_items")
        .update({ is_resolved: true })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fnb-unmatched-items"] });
      toast.success("Item skipped");
    },
  });

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.code} - ${p.name}`,
  }));

  const handleResolve = (itemId: string) => {
    const productId = selectedProducts[itemId];
    if (!productId) {
      toast.error("Please select a product first");
      return;
    }
    resolveMutation.mutate({
      itemId,
      productId,
      asGlobal: addAsGlobal[itemId] || false,
    });
  };

  const pendingCount = unmatchedItems.length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Unmatched Items
            {pendingCount > 0 && (
              <Badge variant="secondary">{pendingCount} pending</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            These items couldn't be matched automatically. Assign the correct product to teach the AI.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : unmatchedItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">All caught up!</p>
          <p className="text-sm">No unmatched items to review</p>
        </div>
      ) : (
        <div className="space-y-3">
          {unmatchedItems.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="space-y-3">
                {/* Original text */}
                <div>
                  <p className="font-medium text-lg">"{item.raw_text}"</p>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <span>From: {item.fnb_customers?.name || "Unknown customer"}</span>
                    <span>•</span>
                    <span>{new Date(item.created_at || "").toLocaleDateString()}</span>
                    {item.detected_language && (
                      <>
                        <span>•</span>
                        <Badge variant="outline" className="text-xs">
                          {item.detected_language.toUpperCase()}
                        </Badge>
                      </>
                    )}
                  </div>
                  {(item.detected_quantity || item.detected_unit) && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Detected: {item.detected_quantity} {item.detected_unit}
                    </p>
                  )}
                </div>

                {/* Product selector */}
                <div className="space-y-2">
                  <SearchableSelect
                    options={productOptions}
                    value={selectedProducts[item.id] || ""}
                    onValueChange={(value) =>
                      setSelectedProducts((prev) => ({ ...prev, [item.id]: value }))
                    }
                    placeholder="Search and select product..."
                    className="h-12"
                  />

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`global-${item.id}`}
                      checked={addAsGlobal[item.id] || false}
                      onCheckedChange={(checked) =>
                        setAddAsGlobal((prev) => ({ ...prev, [item.id]: !!checked }))
                      }
                    />
                    <label
                      htmlFor={`global-${item.id}`}
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Add as global alias (applies to all customers)
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-11"
                    onClick={() => skipMutation.mutate(item.id)}
                    disabled={skipMutation.isPending}
                  >
                    <SkipForward className="h-4 w-4 mr-2" />
                    Skip
                  </Button>
                  <Button
                    className="flex-1 h-11"
                    onClick={() => handleResolve(item.id)}
                    disabled={!selectedProducts[item.id] || resolveMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Save & Learn
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
