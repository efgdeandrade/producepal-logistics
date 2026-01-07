import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  Users,
  Truck,
  Package,
  Wallet,
  ClipboardList,
  MapPin,
  Search,
  Play,
  Calendar,
  FileText,
} from "lucide-react";
import { builtInReportTemplates, ReportTemplate } from "@/lib/reportTemplates";

const iconMap: Record<string, React.ElementType> = {
  DollarSign,
  TrendingUp,
  Users,
  Truck,
  Package,
  Wallet,
  ClipboardList,
  MapPin,
};

const categoryLabels: Record<string, { label: string; description: string }> = {
  sales: { label: "Sales", description: "Revenue, orders, and product performance" },
  operations: { label: "Operations", description: "Delivery, picking, and logistics" },
  finance: { label: "Finance", description: "COD, invoices, and payments" },
  customers: { label: "Customers", description: "Customer analytics and history" },
};

export default function ReportLibrary() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredTemplates = builtInReportTemplates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || template.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleRunReport = (template: ReportTemplate) => {
    navigate(`/executive-reports?template=${template.id}`);
  };

  const handleScheduleReport = (template: ReportTemplate) => {
    navigate(`/scheduled-reports?template=${template.id}`);
  };

  const handleViewBuilder = () => {
    navigate("/report-builder");
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Report Library</h1>
          <p className="text-muted-foreground">
            Pre-built report templates for all your business needs
          </p>
        </div>
        <Button onClick={handleViewBuilder}>
          <FileText className="mr-2 h-4 w-4" />
          Custom Report Builder
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search reports..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList>
          <TabsTrigger value="all">All Reports</TabsTrigger>
          {Object.entries(categoryLabels).map(([key, { label }]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-6">
          {filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No reports found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or category filter
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => {
                const Icon = iconMap[template.icon] || FileText;
                return (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-primary/10 p-2">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <Badge variant="secondary" className="mt-1">
                              {categoryLabels[template.category]?.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="mt-2">{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {template.visualizations.map((viz, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {viz.type}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleRunReport(template)}
                        >
                          <Play className="mr-1 h-3 w-3" />
                          Run Now
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleScheduleReport(template)}
                        >
                          <Calendar className="mr-1 h-3 w-3" />
                          Schedule
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
