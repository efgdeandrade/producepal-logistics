import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

export default function Settings() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [exteriorRate, setExteriorRate] = useState('0');
  const [localRate, setLocalRate] = useState('0');
  const [currencyRate, setCurrencyRate] = useState('1.82');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const roles = ['admin', 'manager', 'management', 'driver', 'production', 'accounting'];
  const resources = ['dashboard', 'orders', 'others', 'logistics', 'production', 'analytics', 'settings', 'users'];

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    loadSettings();
    loadPermissions();
  }, [isAdmin, navigate]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .in('key', ['freight_exterior_tariff', 'freight_local_tariff', 'usd_to_xcg_rate']);

      if (error) throw error;

      data?.forEach((setting) => {
        const value = setting.value as any;
        if (setting.key === 'freight_exterior_tariff') {
          setExteriorRate(value?.rate?.toString() || '0');
        } else if (setting.key === 'freight_local_tariff') {
          setLocalRate(value?.rate?.toString() || '0');
        } else if (setting.key === 'usd_to_xcg_rate') {
          setCurrencyRate(value?.rate?.toString() || '1.82');
        }
      });
    } catch (error: any) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role', { ascending: true })
        .order('resource', { ascending: true });

      if (error) throw error;
      setRolePermissions(data || []);
    } catch (error: any) {
      toast.error('Failed to load permissions');
    }
  };

  const handleSaveTariffs = async () => {
    setSaving(true);
    try {
      const updates = [
        {
          key: 'freight_exterior_tariff',
          value: { rate: parseFloat(exteriorRate), currency: 'USD' },
          description: 'Exterior freight agent tariff'
        },
        {
          key: 'freight_local_tariff',
          value: { rate: parseFloat(localRate), currency: 'USD' },
          description: 'Local freight agent tariff'
        },
        {
          key: 'usd_to_xcg_rate',
          value: { rate: parseFloat(currencyRate) },
          description: 'USD to XCG currency conversion rate'
        }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(update, { onConflict: 'key' });

        if (error) throw error;
      }

      toast.success('Settings saved successfully');
    } catch (error: any) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePermissionChange = async (role: string, resource: string, field: string, value: boolean) => {
    try {
      const existing = rolePermissions.find(p => p.role === role && p.resource === resource);
      const updateData = existing 
        ? { ...existing, [field]: value }
        : { role, resource, can_view: false, can_create: false, can_update: false, can_delete: false, [field]: value };

      const { error } = await supabase
        .from('role_permissions')
        .upsert(updateData as any, { onConflict: 'role,resource' });

      if (error) throw error;

      // Update local state
      setRolePermissions(prev => {
        const existing = prev.find(p => p.role === role && p.resource === resource);
        if (existing) {
          return prev.map(p => 
            p.role === role && p.resource === resource 
              ? { ...p, [field]: value }
              : p
          );
        } else {
          return [...prev, { role, resource, [field]: value }];
        }
      });

      toast.success('Permission updated');
    } catch (error: any) {
      toast.error('Failed to update permission');
    }
  };

  const getPermission = (role: string, resource: string) => {
    return rolePermissions.find(p => p.role === role && p.resource === resource) || {
      can_view: false,
      can_create: false,
      can_update: false,
      can_delete: false
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <Tabs defaultValue="tariffs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tariffs">Currency & Tariffs</TabsTrigger>
            <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="tariffs">
            <Card>
              <CardHeader>
                <CardTitle>Currency & Tariffs</CardTitle>
                <CardDescription>Configure currency conversion and freight tariff rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">USD to XCG Conversion Rate</Label>
                    <Input
                      id="currency"
                      type="number"
                      step="0.01"
                      value={currencyRate}
                      onChange={(e) => setCurrencyRate(e.target.value)}
                      placeholder="1.82"
                    />
                    <p className="text-sm text-muted-foreground">1 USD = {currencyRate} XCG</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exterior">Exterior Agent Tariff (USD)</Label>
                    <Input
                      id="exterior"
                      type="number"
                      step="0.01"
                      value={exteriorRate}
                      onChange={(e) => setExteriorRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="local">Local Agent Tariff (USD $)</Label>
                    <Input
                      id="local"
                      type="number"
                      step="0.01"
                      value={localRate}
                      onChange={(e) => setLocalRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveTariffs} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle>Role Permissions</CardTitle>
                <CardDescription>Configure what each role can access</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Role</th>
                        <th className="text-left p-2">Resource</th>
                        <th className="text-center p-2">View</th>
                        <th className="text-center p-2">Create</th>
                        <th className="text-center p-2">Update</th>
                        <th className="text-center p-2">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roles.map(role => 
                        resources.map(resource => {
                          const perm = getPermission(role, resource);
                          return (
                            <tr key={`${role}-${resource}`} className="border-b hover:bg-muted/50">
                              <td className="p-2 font-medium capitalize">{role}</td>
                              <td className="p-2 capitalize">{resource}</td>
                              <td className="p-2 text-center">
                                <Checkbox
                                  checked={perm.can_view}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(role, resource, 'can_view', checked as boolean)
                                  }
                                />
                              </td>
                              <td className="p-2 text-center">
                                <Checkbox
                                  checked={perm.can_create}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(role, resource, 'can_create', checked as boolean)
                                  }
                                />
                              </td>
                              <td className="p-2 text-center">
                                <Checkbox
                                  checked={perm.can_update}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(role, resource, 'can_update', checked as boolean)
                                  }
                                />
                              </td>
                              <td className="p-2 text-center">
                                <Checkbox
                                  checked={perm.can_delete}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(role, resource, 'can_delete', checked as boolean)
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
