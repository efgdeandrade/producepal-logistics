import { useState, useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Eye, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import LoadingBox from '@/components/LoadingBox';

interface Order {
  id: string;
  order_number: string;
  week_number: number;
  delivery_date: string;
  placed_by: string;
  status: string;
  created_at: string;
  totalItems?: number;
}

const History = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch item counts for each order
      const ordersWithCounts = await Promise.all(
        (data || []).map(async (order) => {
          const { count } = await supabase
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', order.id);

          return {
            ...order,
            totalItems: count || 0,
          };
        })
      );

      setOrders(ordersWithCounts);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.placed_by.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container py-8">
        <LoadingBox />
      </div>
    );
  }

  return (
    <div className="container py-8">
      
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
                      <h3 className="text-xl font-bold text-foreground">{order.order_number}</h3>
                      <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                        order.status === 'completed' ? 'bg-success/10 text-success' :
                        order.status === 'void' ? 'bg-destructive/10 text-destructive' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Week {order.week_number} • Delivery: {new Date(order.delivery_date).toLocaleDateString()} • Placed by {order.placed_by}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total Items: <span className="font-semibold text-foreground">{order.totalItems} items</span>
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/order/${order.id}`)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
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
