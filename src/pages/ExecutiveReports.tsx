import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { RevenueAnalytics } from "../components/analytics/RevenueAnalytics";
import { OperationalMetrics } from "../components/analytics/OperationalMetrics";
import { CustomerInsights } from "../components/analytics/CustomerInsights";
import { ProductAnalytics } from "../components/analytics/ProductAnalytics";
import { Download, FileSpreadsheet, Calendar, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function ExecutiveReports() {
  const [activeTab, setActiveTab] = useState("revenue");
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["revenue"] });
      await queryClient.invalidateQueries({ queryKey: ["delivery"] });
      await queryClient.invalidateQueries({ queryKey: ["customer"] });
      await queryClient.invalidateQueries({ queryKey: ["product"] });
      toast.success("Data refreshed");
    } catch {
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    toast.info("Export functionality coming soon");
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Executive Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive analytics and insights across all operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <RevenueAnalytics />
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <OperationalMetrics />
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <CustomerInsights />
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <ProductAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}