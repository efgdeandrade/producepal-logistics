import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Activity } from 'lucide-react';

interface ActivityLog {
  id: string;
  user_email: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  created_at: string;
}

export default function UserActivity() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const canViewActivity = hasRole('admin') || hasRole('management');

  const fetchActivities = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch activity logs',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    setActivities(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (canViewActivity) {
      fetchActivities();

      // Subscribe to real-time updates
      const channel = supabase
        .channel('activity-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_activity',
          },
          (payload) => {
            setActivities((prev) => [payload.new as ActivityLog, ...prev].slice(0, 100));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [canViewActivity]);

  const getActionBadge = (action: string) => {
    if (action.includes('create') || action.includes('login')) return 'default';
    if (action.includes('update')) return 'secondary';
    if (action.includes('delete')) return 'destructive';
    return 'outline';
  };

  if (!canViewActivity) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-8">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You don't have permission to view activity logs.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto p-8">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">User Activity</h1>
            <p className="text-muted-foreground">Monitor all user actions in the system</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>Recent user actions and changes</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : activities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No activity logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="text-sm">
                        {new Date(activity.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">{activity.user_email}</TableCell>
                      <TableCell>
                        <Badge variant={getActionBadge(activity.action)}>
                          {activity.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {activity.entity_type && (
                          <span className="text-sm text-muted-foreground">
                            {activity.entity_type}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {activity.details && (
                          <span className="text-sm text-muted-foreground">
                            {JSON.stringify(activity.details).substring(0, 50)}...
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
