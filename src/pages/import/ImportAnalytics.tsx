import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  DollarSign,
  Calculator,
  Plane,
  Scale,
  Percent
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ImportAIInsightsPanel } from "@/components/import/ImportAIInsightsPanel";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#82ca9d', '#ffc658', '#8884d8'];

export default function ImportAnalytics() {
  // Fetch CIF calculations for analytics
  const { data: cifCalculations } = useQuery({
    queryKey: ["import-analytics-cif"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cif_calculations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Fetch suppliers for distribution
  const { data: suppliers } = useQuery({
    queryKey: ["import-analytics-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch bills for expense analytics
  const { data: bills } = useQuery({
    queryKey: ["import-analytics-bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .order("bill_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Calculate stats
  const stats = useMemo(() => ({
    totalCIF: cifCalculations?.length || 0,
    avgExchangeRate: cifCalculations?.length 
      ? (cifCalculations.reduce((sum, c) => sum + (c.exchange_rate || 0), 0) / cifCalculations.length).toFixed(2)
      : "0.00",
    totalSuppliers: suppliers?.length || 0,
    totalBillsAmount: bills?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0,
    avgChargeableWeight: cifCalculations?.length
      ? (cifCalculations.reduce((sum, c) => sum + (c.total_chargeable_weight || 0), 0) / cifCalculations.length).toFixed(1)
      : "0",
  }), [cifCalculations, suppliers, bills]);

  // Monthly calculation trend (real data)
  const monthlyData = useMemo(() => {
    if (!cifCalculations) return [];
    
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      return {
        month: format(date, 'MMM'),
        start: startOfMonth(date),
        end: endOfMonth(date),
        calculations: 0,
        freightCost: 0,
      };
    });

    cifCalculations.forEach(calc => {
      const calcDate = new Date(calc.created_at);
      const monthData = last6Months.find(m => 
        calcDate >= m.start && calcDate <= m.end
      );
      if (monthData) {
        monthData.calculations++;
        // Extract freight cost from results if available
        const results = calc.results as any;
        if (results?.byCost) {
          results.byCost.forEach((r: any) => {
            monthData.freightCost += (r.freightCost || 0);
          });
        }
      }
    });

    return last6Months.map(m => ({
      month: m.month,
      calculations: m.calculations,
      freightCost: Math.round(m.freightCost),
    }));
  }, [cifCalculations]);

  // CIF by type distribution
  const typeChartData = useMemo(() => {
    if (!cifCalculations) return [];
    
    const cifByType = cifCalculations.reduce((acc, calc) => {
      const type = calc.calculation_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(cifByType).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [cifCalculations]);

  // Distribution method usage
  const methodChartData = useMemo(() => {
    if (!cifCalculations) return [];
    
    const methodCounts = cifCalculations.reduce((acc, calc) => {
      const method = calc.selected_distribution_method || 'not_selected';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(methodCounts).map(([name, value]) => ({
      name: name.replace(/_/g, ' ').charAt(0).toUpperCase() + name.replace(/_/g, ' ').slice(1),
      value,
    }));
  }, [cifCalculations]);

  // Exchange rate trend
  const exchangeRateTrend = useMemo(() => {
    if (!cifCalculations) return [];
    
    const sorted = [...cifCalculations]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-20);
    
    return sorted.map(calc => ({
      date: format(new Date(calc.created_at), 'MMM d'),
      rate: calc.exchange_rate,
    }));
  }, [cifCalculations]);

  // Supplier spending from bills
  const supplierSpending = useMemo(() => {
    if (!bills) return [];
    
    const spending = bills.reduce((acc, bill) => {
      const vendor = bill.vendor_name || 'Unknown';
      acc[vendor] = (acc[vendor] || 0) + (bill.amount || 0);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(spending)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [bills]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Analytics</h1>
        <p className="text-muted-foreground">
          Performance metrics and insights for import operations
        </p>
      </div>

      {/* AI Insights Panel */}
      <ImportAIInsightsPanel />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CIF Calculations</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCIF}</div>
            <p className="text-xs text-muted-foreground">total calculations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Exchange Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgExchangeRate}</div>
            <p className="text-xs text-muted-foreground">XCG per USD</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSuppliers}</div>
            <p className="text-xs text-muted-foreground">in database</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalBillsAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">expenses tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Weight</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgChargeableWeight}</div>
            <p className="text-xs text-muted-foreground">kg per calculation</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Monthly Calculations & Freight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="calculations" name="Calculations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="freightCost" name="Freight ($)" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Exchange Rate Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {exchangeRateTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={exchangeRateTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis domain={['auto', 'auto']} className="text-xs" />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No exchange rate data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Calculations by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {typeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={typeChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {typeChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Distribution Methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            {methodChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={methodChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {methodChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Top Supplier Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            {supplierSpending.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={supplierSpending} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                  <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No bill data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
