import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { MapPin, Clock, CheckCircle, Package } from 'lucide-react';
import { useState } from 'react';

interface RouteStop {
  id: string;
  customer_id: string;
  sequence_number: number;
  status: string;
  scheduled_time?: string;
  delivery_notes?: string;
  customers: {
    name: string;
    address: string;
    city?: string;
    phone?: string;
  };
}

interface Route {
  id: string;
  route_number: string;
  date: string;
  truck_identifier?: string;
  status: string;
  notes?: string;
}

export default function DriverPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  const { data: routes } = useQuery({
    queryKey: ['driver-routes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('driver_id', user?.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as Route[];
    },
    enabled: !!user,
  });

  const { data: routeStops } = useQuery({
    queryKey: ['route-stops', selectedRoute],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_stops')
        .select('*, customers(*)')
        .eq('route_id', selectedRoute!)
        .order('sequence_number');
      if (error) throw error;
      return data as RouteStop[];
    },
    enabled: !!selectedRoute,
  });

  const updateStopMutation = useMutation({
    mutationFn: async ({
      stopId,
      status,
      notes,
    }: {
      stopId: string;
      status: string;
      notes?: string;
    }) => {
      const updates: any = { status };
      
      if (status === 'completed') {
        updates.completion_time = new Date().toISOString();
      } else if (status === 'in_progress') {
        updates.arrival_time = new Date().toISOString();
      }
      
      if (notes !== undefined) {
        updates.delivery_notes = notes;
      }

      const { error } = await supabase
        .from('route_stops')
        .update(updates)
        .eq('id', stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-stops'] });
      toast({ title: 'Stop updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const currentRoute = routes?.find((r) => r.id === selectedRoute);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Package className="h-5 w-5 text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (!routes || routes.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Driver Portal</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">No routes assigned yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Driver Portal</h1>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Your Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {routes.map((route) => (
                <Button
                  key={route.id}
                  variant={selectedRoute === route.id ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setSelectedRoute(route.id)}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">{route.route_number}</span>
                    <span className="text-xs">{format(new Date(route.date), 'MMM dd, yyyy')}</span>
                  </div>
                  <Badge className="ml-auto" variant="secondary">
                    {route.status}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              {currentRoute
                ? `Route ${currentRoute.route_number} - ${format(new Date(currentRoute.date), 'MMM dd, yyyy')}`
                : 'Select a route'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedRoute ? (
              <p className="text-muted-foreground">Select a route to view stops</p>
            ) : routeStops && routeStops.length > 0 ? (
              <div className="space-y-4">
                {routeStops.map((stop, index) => (
                  <Card key={stop.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                            {stop.sequence_number}
                          </div>
                          {index < routeStops.length - 1 && (
                            <div className="w-0.5 h-12 bg-border mt-2" />
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold">{stop.customers.name}</h3>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>
                                  {stop.customers.address}
                                  {stop.customers.city && `, ${stop.customers.city}`}
                                </span>
                              </div>
                              {stop.customers.phone && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  📞 {stop.customers.phone}
                                </p>
                              )}
                            </div>
                            {getStatusIcon(stop.status)}
                          </div>

                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={stop.status === 'completed'}
                                onCheckedChange={(checked) => {
                                  updateStopMutation.mutate({
                                    stopId: stop.id,
                                    status: checked ? 'completed' : 'pending',
                                  });
                                }}
                              />
                              <span className="text-sm">Mark as delivered</span>
                            </div>

                            <Textarea
                              placeholder="Add delivery notes..."
                              defaultValue={stop.delivery_notes || ''}
                              onBlur={(e) => {
                                if (e.target.value !== stop.delivery_notes) {
                                  updateStopMutation.mutate({
                                    stopId: stop.id,
                                    status: stop.status,
                                    notes: e.target.value,
                                  });
                                }
                              }}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No stops for this route yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
