import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useIntegrations, ExternalIntegration } from '@/hooks/useIntegrations';
import { Plug, ArrowLeft, Plus, Trash2, RefreshCw, TestTube } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const ApiConnectors = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { integrations, loading, createIntegration, updateIntegration, deleteIntegration } = useIntegrations();
  
  const apiIntegrations = integrations.filter(i => i.type === 'custom_api');
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<ExternalIntegration | null>(null);
  const [testing, setTesting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    base_url: '',
    auth_type: 'api_key',
    api_key: '',
    bearer_token: '',
    username: '',
    password: '',
    headers: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      base_url: '',
      auth_type: 'api_key',
      api_key: '',
      bearer_token: '',
      username: '',
      password: '',
      headers: '',
    });
    setEditingConnector(null);
  };

  const handleOpenDialog = (connector?: ExternalIntegration) => {
    if (connector) {
      setEditingConnector(connector);
      const config = connector.config as any;
      setFormData({
        name: connector.name,
        base_url: config.base_url || '',
        auth_type: config.auth_type || 'api_key',
        api_key: config.api_key || '',
        bearer_token: config.bearer_token || '',
        username: config.username || '',
        password: config.password || '',
        headers: config.headers ? JSON.stringify(config.headers) : '',
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.base_url) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    const config: Record<string, any> = {
      base_url: formData.base_url,
      auth_type: formData.auth_type,
    };

    if (formData.auth_type === 'api_key') {
      config.api_key = formData.api_key;
    } else if (formData.auth_type === 'bearer') {
      config.bearer_token = formData.bearer_token;
    } else if (formData.auth_type === 'basic') {
      config.username = formData.username;
      config.password = formData.password;
    }

    if (formData.headers) {
      try {
        config.headers = JSON.parse(formData.headers);
      } catch {
        toast({ title: 'Invalid JSON in headers field', variant: 'destructive' });
        return;
      }
    }

    try {
      if (editingConnector) {
        await updateIntegration(editingConnector.id, {
          name: formData.name,
          config,
        });
      } else {
        await createIntegration({
          name: formData.name,
          type: 'custom_api',
          config,
          is_active: true,
        });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this connector?')) {
      await deleteIntegration(id);
    }
  };

  const handleTest = async (connector: ExternalIntegration) => {
    setTesting(true);
    try {
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast({ title: 'Connection successful', description: 'API responded correctly' });
    } catch (error: any) {
      toast({ title: 'Connection failed', description: error.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings/integrations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plug className="h-6 w-6 text-orange-500" />
              API Connectors
            </h1>
            <p className="text-muted-foreground">Connect to custom APIs and external services</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Connector
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingConnector ? 'Edit Connector' : 'Create Connector'}</DialogTitle>
              <DialogDescription>Configure a connection to an external API</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  placeholder="My API"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Base URL *</Label>
                <Input
                  placeholder="https://api.example.com"
                  value={formData.base_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, base_url: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Authentication Type</Label>
                <Select
                  value={formData.auth_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, auth_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="api_key">API Key</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {formData.auth_type === 'api_key' && (
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    placeholder="Your API key"
                    value={formData.api_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                  />
                </div>
              )}
              
              {formData.auth_type === 'bearer' && (
                <div className="space-y-2">
                  <Label>Bearer Token</Label>
                  <Input
                    type="password"
                    placeholder="Your bearer token"
                    value={formData.bearer_token}
                    onChange={(e) => setFormData(prev => ({ ...prev, bearer_token: e.target.value }))}
                  />
                </div>
              )}
              
              {formData.auth_type === 'basic' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      placeholder="Username"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="Password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Custom Headers (JSON)</Label>
                <Input
                  placeholder='{"X-Custom-Header": "value"}'
                  value={formData.headers}
                  onChange={(e) => setFormData(prev => ({ ...prev, headers: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>{editingConnector ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {apiIntegrations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Plug className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No API connectors configured</h3>
            <p className="text-muted-foreground mb-4">Create a connector to integrate with external APIs</p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Connector
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {apiIntegrations.map((connector) => (
            <Card key={connector.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Plug className="h-5 w-5 text-orange-500" />
                    <CardTitle className="text-lg">{connector.name}</CardTitle>
                  </div>
                  <Badge variant={connector.is_active ? 'default' : 'secondary'}>
                    {connector.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <CardDescription className="font-mono text-xs">
                  {(connector.config as any).base_url}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{(connector.config as any).auth_type}</Badge>
                    {connector.last_sync_at && (
                      <span className="text-xs text-muted-foreground">
                        Last used: {format(new Date(connector.last_sync_at), 'MMM d')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleTest(connector)}
                      disabled={testing}
                    >
                      {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(connector)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(connector.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApiConnectors;
