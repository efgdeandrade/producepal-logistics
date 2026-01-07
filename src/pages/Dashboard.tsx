import { useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, TrendingUp, Users, Calendar, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FnbAlertsCard } from '@/components/fnb/FnbAlertsCard';

interface ChartData {
  period: string;
  usd: number;
  xcg: number;
  suppliers: Record<string, { usd: number; xcg: number }>;
}

const Dashboard = () => {
  const [todayOrders, setTodayOrders] = useState(0);
  const [weekOrders, setWeekOrders] = useState(0);
  const [activeCustomers, setActiveCustomers] = useState(0);
  const [weeklyData, setWeeklyData] = useState<ChartData[]>([]);
  const [monthlyData, setMonthlyData] = useState<ChartData[]>([]);
  const [yearlyData, setYearlyData] = useState<ChartData[]>([]);
  const [lastYearWeekComparison, setLastYearWeekComparison] = useState({ current: 0, lastYear: 0, change: 0 });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const now = new Date();
      const currentWeek = getWeekNumber(now);
      const currentYear = now.getFullYear();
      
      // Fetch orders with items and products
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            customer_name,
            product_code,
            quantity
          )
        `)
        .eq('status', 'active');

      if (!orders) return;

      // Fetch products for pricing
      const { data: products } = await supabase
        .from('products')
        .select('code, price_usd, price_xcg, supplier_id, suppliers(name)');

      const productMap = new Map(products?.map(p => [p.code, p]) || []);

      // Calculate today's orders
      const today = now.toISOString().split('T')[0];
      const todayOrdersCount = orders.filter(o => o.delivery_date === today).length;
      setTodayOrders(todayOrdersCount);

      // Calculate week orders
      const weekOrdersCount = orders.filter(o => {
        const orderWeek = getWeekNumber(new Date(o.delivery_date));
        return orderWeek === currentWeek && new Date(o.delivery_date).getFullYear() === currentYear;
      }).length;
      setWeekOrders(weekOrdersCount);

      // Calculate active customers (unique this week)
      const weekCustomers = new Set(
        orders
          .filter(o => {
            const orderWeek = getWeekNumber(new Date(o.delivery_date));
            return orderWeek === currentWeek && new Date(o.delivery_date).getFullYear() === currentYear;
          })
          .flatMap(o => o.order_items?.map(item => item.customer_name) || [])
      );
      setActiveCustomers(weekCustomers.size);

      // Generate weekly data (last 12 weeks)
      const weekly = generateWeeklyData(orders, productMap, currentWeek, currentYear);
      setWeeklyData(weekly);

      // Generate monthly data (last 12 months)
      const monthly = generateMonthlyData(orders, productMap);
      setMonthlyData(monthly);

      // Generate yearly data (last 5 years)
      const yearly = generateYearlyData(orders, productMap);
      setYearlyData(yearly);

      // Calculate year-over-year comparison for current week
      const currentWeekTotal = calculateWeekTotal(orders, productMap, currentWeek, currentYear);
      const lastYearWeekTotal = calculateWeekTotal(orders, productMap, currentWeek, currentYear - 1);
      const change = lastYearWeekTotal > 0 
        ? ((currentWeekTotal - lastYearWeekTotal) / lastYearWeekTotal) * 100 
        : 0;
      
      setLastYearWeekComparison({
        current: currentWeekTotal,
        lastYear: lastYearWeekTotal,
        change: Math.round(change)
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const calculateWeekTotal = (orders: any[], productMap: Map<string, any>, week: number, year: number): number => {
    return orders
      .filter(o => {
        const orderDate = new Date(o.delivery_date);
        return getWeekNumber(orderDate) === week && orderDate.getFullYear() === year;
      })
      .reduce((sum, order) => {
        const orderTotal = (order.order_items || []).reduce((itemSum: number, item: any) => {
          const product = productMap.get(item.product_code);
          return itemSum + (item.quantity * (product?.price_usd || 0));
        }, 0);
        return sum + orderTotal;
      }, 0);
  };

  const generateWeeklyData = (orders: any[], productMap: Map<string, any>, currentWeek: number, currentYear: number): ChartData[] => {
    const data: ChartData[] = [];
    
    for (let i = 11; i >= 0; i--) {
      let week = currentWeek - i;
      let year = currentYear;
      
      if (week <= 0) {
        year--;
        week = 52 + week;
      }

      const weekOrders = orders.filter(o => {
        const orderDate = new Date(o.delivery_date);
        return getWeekNumber(orderDate) === week && orderDate.getFullYear() === year;
      });

      const suppliers: Record<string, { usd: number; xcg: number }> = {};
      let totalUsd = 0;
      let totalXcg = 0;

      weekOrders.forEach(order => {
        (order.order_items || []).forEach((item: any) => {
          const product = productMap.get(item.product_code);
          if (product) {
            const supplierName = product.suppliers?.name || 'Unknown';
            const itemUsd = item.quantity * (product.price_usd || 0);
            const itemXcg = item.quantity * (product.price_xcg || 0);

            if (!suppliers[supplierName]) {
              suppliers[supplierName] = { usd: 0, xcg: 0 };
            }
            suppliers[supplierName].usd += itemUsd;
            suppliers[supplierName].xcg += itemXcg;
            totalUsd += itemUsd;
            totalXcg += itemXcg;
          }
        });
      });

      data.push({
        period: `Week ${week}`,
        usd: Math.round(totalUsd),
        xcg: Math.round(totalXcg),
        suppliers
      });
    }

    return data;
  };

  const generateMonthlyData = (orders: any[], productMap: Map<string, any>): ChartData[] => {
    const data: ChartData[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.getMonth();
      const year = date.getFullYear();

      const monthOrders = orders.filter(o => {
        const orderDate = new Date(o.delivery_date);
        return orderDate.getMonth() === month && orderDate.getFullYear() === year;
      });

      const suppliers: Record<string, { usd: number; xcg: number }> = {};
      let totalUsd = 0;
      let totalXcg = 0;

      monthOrders.forEach(order => {
        (order.order_items || []).forEach((item: any) => {
          const product = productMap.get(item.product_code);
          if (product) {
            const supplierName = product.suppliers?.name || 'Unknown';
            const itemUsd = item.quantity * (product.price_usd || 0);
            const itemXcg = item.quantity * (product.price_xcg || 0);

            if (!suppliers[supplierName]) {
              suppliers[supplierName] = { usd: 0, xcg: 0 };
            }
            suppliers[supplierName].usd += itemUsd;
            suppliers[supplierName].xcg += itemXcg;
            totalUsd += itemUsd;
            totalXcg += itemXcg;
          }
        });
      });

      data.push({
        period: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        usd: Math.round(totalUsd),
        xcg: Math.round(totalXcg),
        suppliers
      });
    }

    return data;
  };

  const generateYearlyData = (orders: any[], productMap: Map<string, any>): ChartData[] => {
    const data: ChartData[] = [];
    const currentYear = new Date().getFullYear();

    for (let i = 4; i >= 0; i--) {
      const year = currentYear - i;

      const yearOrders = orders.filter(o => new Date(o.delivery_date).getFullYear() === year);

      const suppliers: Record<string, { usd: number; xcg: number }> = {};
      let totalUsd = 0;
      let totalXcg = 0;

      yearOrders.forEach(order => {
        (order.order_items || []).forEach((item: any) => {
          const product = productMap.get(item.product_code);
          if (product) {
            const supplierName = product.suppliers?.name || 'Unknown';
            const itemUsd = item.quantity * (product.price_usd || 0);
            const itemXcg = item.quantity * (product.price_xcg || 0);

            if (!suppliers[supplierName]) {
              suppliers[supplierName] = { usd: 0, xcg: 0 };
            }
            suppliers[supplierName].usd += itemUsd;
            suppliers[supplierName].xcg += itemXcg;
            totalUsd += itemUsd;
            totalXcg += itemXcg;
          }
        });
      });

      data.push({
        period: year.toString(),
        usd: Math.round(totalUsd),
        xcg: Math.round(totalXcg),
        suppliers
      });
    }

    return data;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    const suppliers = data.suppliers || {};

    return (
      <div className="bg-card border rounded-lg shadow-lg p-4">
        <p className="font-semibold text-foreground mb-2">{data.period}</p>
        <div className="space-y-1 mb-3">
          <p className="text-sm">
            <span className="text-chart-1 font-medium">USD:</span>{' '}
            <span className="text-foreground">${data.usd.toLocaleString()}</span>
          </p>
          <p className="text-sm">
            <span className="text-chart-2 font-medium">Cg:</span>{' '}
            <span className="text-foreground">Cg {data.xcg.toLocaleString()}</span>
          </p>
        </div>
        {Object.keys(suppliers).length > 0 && (
          <div className="border-t pt-2">
            <p className="text-xs font-semibold text-muted-foreground mb-1">By Supplier:</p>
            {Object.entries(suppliers).map(([name, values]: [string, any]) => (
              <div key={name} className="text-xs space-y-0.5 mb-1">
                <p className="font-medium text-foreground">{name}</p>
                <p className="text-muted-foreground pl-2">
                  USD: ${values.usd.toLocaleString()} | Cg: {values.xcg.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your order overview.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Orders</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{todayOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">Active orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{weekOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">Total orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{activeCustomers}</div>
              <p className="text-xs text-muted-foreground mt-1">This week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quick Action</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/order/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Order
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Distribution Alerts (Compact) */}
        <div className="mb-8">
          <FnbAlertsCard compact />
        </div>

        {/* Year-over-Year Comparison */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Week-over-Week Comparison</CardTitle>
            <CardDescription>Current week vs same week last year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-3xl font-bold text-primary">${lastYearWeekComparison.current.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Same Week Last Year</p>
                <p className="text-3xl font-bold text-muted-foreground">${lastYearWeekComparison.lastYear.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Change</p>
                <p className={`text-3xl font-bold ${lastYearWeekComparison.change >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {lastYearWeekComparison.change >= 0 ? '+' : ''}{lastYearWeekComparison.change}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Sales Analytics</CardTitle>
            <CardDescription>View amounts in USD and Cg across different time periods</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="weekly" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
              </TabsList>

              <TabsContent value="weekly" className="space-y-4">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="period" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="usd" fill="hsl(var(--chart-1))" name="USD" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="xcg" fill="hsl(var(--chart-2))" name="Cg" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="monthly" className="space-y-4">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="period" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="usd" 
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-1))' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="xcg" 
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-2))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="yearly" className="space-y-4">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="period" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="usd" fill="hsl(var(--chart-1))" name="USD" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="xcg" fill="hsl(var(--chart-2))" name="Cg" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
      </CardContent>
    </Card>
  </div>
);
};

export default Dashboard;
