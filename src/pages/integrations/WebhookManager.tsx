import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useWebhooks, WebhookConfig } from '@/hooks/useIntegrations';
import { Webhook, ArrowLeft, Plus, Copy, Trash2, RefreshCw, Check, X, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const AVAILABLE_EVENTS = [
  { category: 'Orders', events: ['order.created', 'order.updated', 'order.cancelled', 'order.picked'] },
  { category: 'Deliveries', events: ['delivery.started', 'delivery.completed', 'delivery.failed'] },
  { category: 'Customers', events: ['customer.created', 'customer.updated'] },
  { category: 'Payments', events: ['cod.collected', 'payment.received'] },
  { category: 'Inventory', events: ['shortage.reported', 'shortage.resolved'] },
];

const WebhookManager = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { webhooks, logs, loading, createWebhook, updateWebhook, deleteWebhook, generateSecret, refetchLogs } = useWebhooks();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      events: [],
      secret: generateSecret(),
      is_active: true,
    });
    setEditingWebhook(null);
  };

  const handleOpenDialog = (webhook?: WebhookConfig) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setFormData({
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret,
        is_active: webhook.is_active,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.url || formData.events.length === 0) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      if (editingWebhook) {
        await updateWebhook(editingWebhook.id, formData);
      } else {
        await createWebhook({
          ...formData,
          headers: {},
          retry_count: 3,
        });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this webhook?')) {
      await deleteWebhook(id);
    }
  };

  const handleEventToggle = (event: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast({ title: 'Secret copied to clipboard' });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/integrations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Webhook className="h-6 w-6 text-purple-500" />
              Webhook Manager
            </h1>
            <p className="text-muted-foreground">Configure outbound webhook notifications</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
              <DialogDescription>Configure a webhook endpoint to receive event notifications</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    placeholder="My Webhook"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL *</Label>
                  <Input
                    placeholder="https://example.com/webhook"
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Secret Key</Label>
                <div className="flex gap-2">
                  <Input value={formData.secret} readOnly className="font-mono text-xs" />
                  <Button variant="outline" onClick={() => copySecret(formData.secret)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => setFormData(prev => ({ ...prev, secret: generateSecret() }))}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Use this secret to verify webhook signatures</p>
              </div>
              <div className="space-y-2">
                <Label>Events *</Label>
                <div className="border rounded-lg p-4 space-y-4 max-h-60 overflow-y-auto">
                  {AVAILABLE_EVENTS.map((category) => (
                    <div key={category.category}>
                      <p className="font-medium text-sm mb-2">{category.category}</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {category.events.map((event) => (
                          <div key={event} className="flex items-center space-x-2">
                            <Checkbox
                              id={event}
                              checked={formData.events.includes(event)}
                              onCheckedChange={() => handleEventToggle(event)}
                            />
                            <label htmlFor={event} className="text-sm cursor-pointer">
                              {event}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>{editingWebhook ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="webhooks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="logs">Delivery Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-4">
          {webhooks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No webhooks configured</h3>
                <p className="text-muted-foreground mb-4">Create a webhook to send event notifications to external systems</p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Webhook
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {webhooks.map((webhook) => (
                <Card key={webhook.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{webhook.name}</CardTitle>
                        <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                          {webhook.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenDialog(webhook)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(webhook.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription className="font-mono text-xs">{webhook.url}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="outline">{event}</Badge>
                      ))}
                    </div>
                    {webhook.last_triggered_at && (
                      <p className="text-xs text-muted-foreground mt-3">
                        Last triggered: {format(new Date(webhook.last_triggered_at), 'MMM d, h:mm a')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Logs</CardTitle>
              <CardDescription>Recent webhook delivery attempts</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No delivery logs yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Attempt</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.event_type}</TableCell>
                        <TableCell>
                          <Badge variant={log.response_status && log.response_status < 400 ? 'default' : 'destructive'}>
                            {log.response_status ? (
                              <>
                                {log.response_status < 400 ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                                {log.response_status}
                              </>
                            ) : (
                              'Failed'
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.duration_ms ? `${log.duration_ms}ms` : '-'}</TableCell>
                        <TableCell>{log.attempt_number}</TableCell>
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

export default WebhookManager;
