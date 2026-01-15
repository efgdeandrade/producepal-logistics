import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ShoppingCart,
  Package,
  UserX,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Check,
  X,
  Clock,
  Brain,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { AnomalyDetailDialog } from "./AnomalyDetailDialog";

interface Anomaly {
  id: string;
  customer_id: string;
  anomaly_type: string;
  severity: string;
  detected_at: string;
  expected_date: string;
  details: any;
  suggested_message_en: string;
  suggested_message_pap: string;
  suggested_message_nl: string;
  status: string;
  distribution_customers?: {
    name: string;
    whatsapp_phone: string;
    preferred_language: string;
  };
}

export function MissingOrdersCard() {
  const queryClient = useQueryClient();
  const [expandedType, setExpandedType] = useState<string | null>("missing_order");
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: anomalies, isLoading } = useQuery({
    queryKey: ["order-anomalies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_order_anomalies")
        .select("*, distribution_customers(name, whatsapp_phone, preferred_language)")
        .in("status", ["pending", "contacted"])
        .order("detected_at", { ascending: false });

      if (error) throw error;
      return data as Anomaly[];
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("distribution_order_anomalies")
        .update({
          status,
          resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-anomalies"] });
      toast.success("Status updated");
    },
  });

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      const { data, error } = await supabase.functions.invoke("order-pattern-analyzer", {
        body: { force_reanalyze: true },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["order-anomalies"] });
      toast.success(`Analysis complete: ${data.anomaliesDetected} anomalies detected`);
    },
    onError: (error) => {
      toast.error("Analysis failed: " + (error as Error).message);
    },
    onSettled: () => {
      setIsAnalyzing(false);
    },
  });

  const groupedAnomalies = {
    missing_order: anomalies?.filter((a) => a.anomaly_type === "missing_order") || [],
    missing_item: anomalies?.filter((a) => a.anomaly_type === "missing_item") || [],
    inactive_customer: anomalies?.filter((a) => a.anomaly_type === "inactive_customer") || [],
    quantity_change: anomalies?.filter((a) => a.anomaly_type === "quantity_change") || [],
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "missing_order":
        return <ShoppingCart className="h-4 w-4" />;
      case "missing_item":
        return <Package className="h-4 w-4" />;
      case "inactive_customer":
        return <UserX className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "missing_order":
        return "Missing Orders";
      case "missing_item":
        return "Missing Items";
      case "inactive_customer":
        return "Inactive Customers";
      case "quantity_change":
        return "Quantity Changes";
      default:
        return type;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  const totalAnomalies = anomalies?.length || 0;

  return (
    <>
      <Card className="col-span-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Order Intelligence</CardTitle>
            {totalAnomalies > 0 && (
              <Badge variant="destructive">{totalAnomalies}</Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runAnalysisMutation.mutate()}
            disabled={isAnalyzing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? "animate-spin" : ""}`} />
            {isAnalyzing ? "Analyzing..." : "Run Analysis"}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : totalAnomalies === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Check className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p className="font-medium">All patterns normal</p>
              <p className="text-sm">No order anomalies detected</p>
            </div>
          ) : (
            <Tabs defaultValue="missing_order" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="missing_order" className="text-xs">
                  Orders ({groupedAnomalies.missing_order.length})
                </TabsTrigger>
                <TabsTrigger value="missing_item" className="text-xs">
                  Items ({groupedAnomalies.missing_item.length})
                </TabsTrigger>
                <TabsTrigger value="inactive_customer" className="text-xs">
                  Inactive ({groupedAnomalies.inactive_customer.length})
                </TabsTrigger>
                <TabsTrigger value="quantity_change" className="text-xs">
                  Qty ({groupedAnomalies.quantity_change.length})
                </TabsTrigger>
              </TabsList>

              {Object.entries(groupedAnomalies).map(([type, items]) => (
                <TabsContent key={type} value={type} className="mt-4">
                  {items.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      No {getTypeLabel(type).toLowerCase()} detected
                    </p>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {items.map((anomaly) => (
                          <div
                            key={anomaly.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                            onClick={() => setSelectedAnomaly(anomaly)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                anomaly.severity === "high" 
                                  ? "bg-destructive/10 text-destructive" 
                                  : anomaly.severity === "medium"
                                  ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30"
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                {getTypeIcon(anomaly.anomaly_type)}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {anomaly.details?.customer_name || "Unknown Customer"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {anomaly.anomaly_type === "missing_order" && (
                                    <>Usually orders {anomaly.details?.expected_days_names}</>
                                  )}
                                  {anomaly.anomaly_type === "missing_item" && (
                                    <>Missing: {anomaly.details?.product_name}</>
                                  )}
                                  {anomaly.anomaly_type === "inactive_customer" && (
                                    <>{anomaly.details?.days_since_last_order} days since last order</>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={getSeverityColor(anomaly.severity) as any}>
                                {anomaly.severity}
                              </Badge>
                              {anomaly.status === "contacted" && (
                                <Badge variant="outline" className="text-xs">
                                  <MessageCircle className="h-3 w-3 mr-1" />
                                  Contacted
                                </Badge>
                              )}
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatusMutation.mutate({
                                      id: anomaly.id,
                                      status: "contacted",
                                    });
                                  }}
                                >
                                  <MessageCircle className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatusMutation.mutate({
                                      id: anomaly.id,
                                      status: "resolved",
                                    });
                                  }}
                                >
                                  <Check className="h-4 w-4 text-green-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatusMutation.mutate({
                                      id: anomaly.id,
                                      status: "dismissed",
                                    });
                                  }}
                                >
                                  <X className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      <AnomalyDetailDialog
        anomaly={selectedAnomaly}
        open={!!selectedAnomaly}
        onOpenChange={(open) => !open && setSelectedAnomaly(null)}
        onStatusChange={(status) => {
          if (selectedAnomaly) {
            updateStatusMutation.mutate({ id: selectedAnomaly.id, status });
          }
        }}
      />
    </>
  );
}
