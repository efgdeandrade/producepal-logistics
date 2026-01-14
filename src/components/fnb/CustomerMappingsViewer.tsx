import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Trash2, Users, Shield, Brain } from "lucide-react";
import { toast } from "sonner";

export function CustomerMappingsViewer() {
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ["distribution-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_customers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch mappings for selected customer
  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["distribution-customer-mappings", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const { data, error } = await supabase
        .from("distribution_customer_product_mappings")
        .select(`
          id,
          customer_sku,
          customer_product_name,
          product_id,
          is_verified,
          confidence_score,
          created_at,
          updated_at,
          distribution_products (id, code, name)
        `)
        .eq("customer_id", selectedCustomerId)
        .order("customer_product_name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomerId,
  });

  // Verify mapping
  const verifyMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from("distribution_customer_product_mappings")
        .update({ is_verified: true, confidence_score: 1.0 })
        .eq("id", mappingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-customer-mappings"] });
      toast.success("Mapping verified");
    },
  });

  // Delete mapping
  const deleteMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from("distribution_customer_product_mappings")
        .delete()
        .eq("id", mappingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-customer-mappings"] });
      toast.success("Mapping deleted");
    },
  });

  const customerOptions = customers.map((c: any) => ({
    value: c.id,
    label: c.name,
  }));

  const verifiedCount = mappings.filter((m: any) => m.is_verified).length;
  const aiLearnedCount = mappings.filter((m: any) => !m.is_verified).length;

  return (
    <div className="space-y-4">
      {/* Customer Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer Mappings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SearchableSelect
            options={customerOptions}
            value={selectedCustomerId}
            onValueChange={setSelectedCustomerId}
            placeholder="Select a customer..."
            className="h-12"
          />
        </CardContent>
      </Card>

      {selectedCustomerId && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{verifiedCount}</p>
                  <p className="text-xs text-muted-foreground">Verified</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{aiLearnedCount}</p>
                  <p className="text-xs text-muted-foreground">AI Learned</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Mappings List */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading mappings...</div>
          ) : mappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No mappings yet</p>
              <p className="text-sm">The AI will learn from order processing</p>
            </div>
          ) : (
            <div className="space-y-2">
              {mappings.map((mapping: any) => (
                <Card key={mapping.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">"{mapping.customer_product_name}"</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-sm">{mapping.distribution_products?.name || "Unknown"}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        {mapping.is_verified ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                            <Brain className="h-3 w-3 mr-1" />
                            AI Learned
                          </Badge>
                        )}
                      </div>

                      {/* Confidence bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Confidence:</span>
                        <Progress 
                          value={(mapping.confidence_score || 0) * 100} 
                          className="h-2 flex-1"
                        />
                        <span className="text-xs font-medium">
                          {Math.round((mapping.confidence_score || 0) * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      {!mapping.is_verified && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => verifyMutation.mutate(mapping.id)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verify
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(mapping.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}