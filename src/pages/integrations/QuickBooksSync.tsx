import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIntegrations } from '@/hooks/useIntegrations';
import { RefreshCw, ArrowLeft, Check, X, Clock, Users, FileText, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

const QuickBooksSync = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { integrations, createIntegration, updateIntegration } = useIntegrations();
  const [syncing, setSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);

  const qbIntegration = integrations.find(i => i.type === 'quickbooks');

  const handleToggle = async (enabled: boolean) => {
    if (qbIntegration) {
      await updateIntegration(qbIntegration.id, { is_active: enabled });
    } else {
      await createIntegration({
        name: 'QuickBooks',
        type: 'quickbooks',
        config: {},
        is_active: enabled,
      });
    }
  };

  const handleSync = async (entityType: string) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('quickbooks-sync', {
        body: { entity_type: entityType },
      });

      if (error) throw error;
      
      toast({ 
        title: 'Sync completed', 
        description: `${entityType} synced successfully` 
      });
      
      // Refresh sync logs
      loadSyncLogs();
    } catch (error: any) {
      toast({ 
        title: 'Sync failed', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setSyncing(false);
    }
  };

  const loadSyncLogs = async () => {
    const { data } = await supabase
      .from('quickbooks_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setSyncLogs(data);
  };

  const syncEntities = [
    { type: 'customers', label: 'Customers', icon: Users, description: 'Sync customer records' },
    { type: 'invoices', label: 'Invoices', icon: FileText, description: 'Sync invoice data' },
    { type: 'payments', label: 'Payments', icon: DollarSign, description: 'Sync payment records' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings/integrations')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-blue-500" />
            QuickBooks Integration
          </h1>
          <p className="text-muted-foreground">Sync data between DiTo and QuickBooks</p>
        </div>
      </div>

      <Tabs defaultValue="sync" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sync">Sync</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Connection Status</CardTitle>
                  <CardDescription>QuickBooks integration status</CardDescription>
                </div>
                <Switch
                  checked={qbIntegration?.is_active || false}
                  onCheckedChange={handleToggle}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={qbIntegration?.is_active ? 'default' : 'secondary'}>
                  {qbIntegration?.is_active ? 'Connected' : 'Disconnected'}
                </Badge>
                {qbIntegration?.last_sync_at && (
                  <span className="text-sm text-muted-foreground">
                    Last sync: {format(new Date(qbIntegration.last_sync_at), 'MMM d, h:mm a')}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {syncEntities.map((entity) => (
              <Card key={entity.type}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <entity.icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{entity.label}</CardTitle>
                  </div>
                  <CardDescription>{entity.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => handleSync(entity.type)}
                    disabled={syncing || !qbIntegration?.is_active}
                  >
                    {syncing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sync All</CardTitle>
              <CardDescription>Perform a full sync of all entities</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="lg"
                onClick={() => handleSync('all')}
                disabled={syncing || !qbIntegration?.is_active}
              >
                {syncing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Full Sync
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Settings</CardTitle>
              <CardDescription>Configure sync behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-sync on order creation</p>
                  <p className="text-sm text-muted-foreground">Automatically sync invoices when orders are created</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Sync payments</p>
                  <p className="text-sm text-muted-foreground">Mark invoices as paid when COD is collected</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Create customers automatically</p>
                  <p className="text-sm text-muted-foreground">Create new QuickBooks customers for new F&B customers</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>Recent sync operations</CardDescription>
            </CardHeader>
            <CardContent>
              {syncLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No sync history yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.entity_type}</TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                            {log.status === 'success' ? (
                              <Check className="h-3 w-3 mr-1" />
                            ) : (
                              <X className="h-3 w-3 mr-1" />
                            )}
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.records_synced || 0}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(log.created_at), 'MMM d, h:mm a')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QuickBooksSync;
