import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Edit, MapPin } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Route {
  id: string;
  route_number: string;
  date: string;
  driver_id?: string;
  driver_name: string;
  truck_identifier?: string;
  status: string;
  notes?: string;
}

export default function Routes() {
  const { toast } = useToast();
  const { hasRole, user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);

  const canManage = hasRole('admin') || hasRole('management');

  const { data: routes, isLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data as Route[];
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(id, full_name, email)')
        .eq('role', 'driver');
      if (error) throw error;
      return data;
    },
    enabled: canManage,
  });

  const createMutation = useMutation({
    mutationFn: async (values: { route_number: string; date: string; driver_id?: string | null; driver_name: string; truck_identifier?: string; status: string; notes?: string }) => {
      const { error } = await supabase.from('routes').insert([{
        ...values,
        created_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({ title: 'Route created successfully' });
      setDialogOpen(false);
      setEditingRoute(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: Partial<Route> & { id: string }) => {
      const { error } = await supabase
        .from('routes')
        .update(values)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({ title: 'Route updated successfully' });
      setDialogOpen(false);
      setEditingRoute(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const driverId = formData.get('driver_id') as string;
    const driverName = drivers?.find((d: any) => d.user_id === driverId)?.profiles?.full_name || '';
    
    const values = {
      route_number: formData.get('route_number') as string,
      date: formData.get('date') as string,
      driver_id: driverId || null,
      driver_name: driverName || (formData.get('driver_name') as string),
      truck_identifier: formData.get('truck_identifier') as string,
      status: formData.get('status') as string,
      notes: formData.get('notes') as string,
    };

    if (editingRoute) {
      updateMutation.mutate({ id: editingRoute.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      in_progress: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Routes</h1>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingRoute(null)}>
                <Plus className="mr-2 h-4 w-4" /> Create Route
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingRoute ? 'Edit Route' : 'Create New Route'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="route_number">Route Number *</Label>
                    <Input
                      id="route_number"
                      name="route_number"
                      required
                      defaultValue={editingRoute?.route_number}
                    />
                  </div>
                  <div>
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      required
                      defaultValue={editingRoute?.date}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="driver_id">Driver</Label>
                    <Select name="driver_id" defaultValue={editingRoute?.driver_id}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers?.map((driver: any) => (
                          <SelectItem key={driver.user_id} value={driver.user_id}>
                            {driver.profiles?.full_name || driver.profiles?.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="driver_name">Driver Name (if not in list)</Label>
                    <Input
                      id="driver_name"
                      name="driver_name"
                      defaultValue={editingRoute?.driver_name}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="truck_identifier">Truck ID</Label>
                    <Input
                      id="truck_identifier"
                      name="truck_identifier"
                      defaultValue={editingRoute?.truck_identifier}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status *</Label>
                    <Select name="status" defaultValue={editingRoute?.status || 'pending'}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    defaultValue={editingRoute?.notes}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingRoute ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes?.map((route) => (
                <TableRow key={route.id}>
                  <TableCell className="font-medium">{route.route_number}</TableCell>
                  <TableCell>{format(new Date(route.date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{route.driver_name}</TableCell>
                  <TableCell>{route.truck_identifier || '-'}</TableCell>
                  <TableCell>{getStatusBadge(route.status)}</TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingRoute(route);
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // TODO: Navigate to route details/stops
                            toast({ title: 'Route details coming soon' });
                          }}
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
