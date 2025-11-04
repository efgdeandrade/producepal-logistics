import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, TrendingUp, Users, Calendar, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const todayOrders = 3;
  const weekOrders = 12;
  const activeCustomers = 8;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
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
                <Link to="/new-order">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Order
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Your latest order activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold text-foreground">Order #1045</p>
                    <p className="text-sm text-muted-foreground">Week 45 - Nov 03, 2025</p>
                  </div>
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-success/10 text-success">
                    Completed
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold text-foreground">Order #1044</p>
                    <p className="text-sm text-muted-foreground">Week 44 - Oct 27, 2025</p>
                  </div>
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-success/10 text-success">
                    Completed
                  </span>
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/history">View All History</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>Week 45 overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Strawberries 500g</span>
                  <span className="font-semibold text-foreground">115 trays</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Blueberries 125g</span>
                  <span className="font-semibold text-foreground">104 trays</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cherry Tomatoes 250g</span>
                  <span className="font-semibold text-foreground">24 trays</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Strawberries 250g</span>
                  <span className="font-semibold text-foreground">12 trays</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
