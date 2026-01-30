import { useState, useEffect } from 'react';
import { format } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Eye, ArrowLeft, Plus, CalendarIcon, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import LoadingBox from '@/components/LoadingBox';
import { formatCuracao, parseDateCuracao } from '@/lib/dateUtils';

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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
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

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.placed_by.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate =
      !selectedDate ||
      format(parseDateCuracao(order.delivery_date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
    
    return matchesSearch && matchesDate;
  });

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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/import')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Order History</h1>
              <p className="text-muted-foreground">View and manage all past orders</p>
            </div>
          </div>
          <Button onClick={() => navigate('/import/orders/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search Orders</CardTitle>
            <CardDescription>Find orders by number, customer, or date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order number or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {selectedDate && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setSelectedDate(undefined)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
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
                      Week {order.week_number} • Delivery: {formatCuracao(order.delivery_date, 'PPP')} • Placed by {order.placed_by}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total Items: <span className="font-semibold text-foreground">{order.totalItems} items</span>
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/import/orders/${order.id}`)}
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
