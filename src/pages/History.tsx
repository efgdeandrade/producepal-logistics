import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Printer, Eye, Ban, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const mockOrders = [
  {
    id: '1',
    orderNumber: 'ORD-1045',
    weekNumber: 45,
    deliveryDate: '2025-11-03',
    placedBy: 'Dane',
    status: 'completed' as const,
    createdAt: '2025-11-01',
    totalItems: 255,
  },
  {
    id: '2',
    orderNumber: 'ORD-1044',
    weekNumber: 44,
    deliveryDate: '2025-10-27',
    placedBy: 'Sarah',
    status: 'completed' as const,
    createdAt: '2025-10-25',
    totalItems: 189,
  },
  {
    id: '3',
    orderNumber: 'ORD-1043',
    weekNumber: 43,
    deliveryDate: '2025-10-20',
    placedBy: 'Dane',
    status: 'completed' as const,
    createdAt: '2025-10-18',
    totalItems: 312,
  },
];

const History = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOrders = mockOrders.filter(order =>
    order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.placedBy.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Order History</h1>
            <p className="text-muted-foreground">View and manage all past orders</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search Orders</CardTitle>
            <CardDescription>Find orders by number, customer, or date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order number or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-foreground">{order.orderNumber}</h3>
                      <span className="text-xs font-medium px-3 py-1 rounded-full bg-success/10 text-success">
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Week {order.weekNumber} • Delivery: {new Date(order.deliveryDate).toLocaleDateString()} • Placed by {order.placedBy}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total Items: <span className="font-semibold text-foreground">{order.totalItems} units</span>
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button variant="outline" size="sm">
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button variant="outline" size="sm">
                      <Ban className="mr-2 h-4 w-4" />
                      Void
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No orders found matching your search.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default History;
