import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Calendar, ArrowRight, Plus, Trash2, Search, Plug } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { RolePermissionCard } from '@/components/settings/RolePermissionCard';

export default function Settings() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [exteriorRate, setExteriorRate] = useState('0');
  const [localRate, setLocalRate] = useState('0');
  const [currencyRate, setCurrencyRate] = useState('1.82');
  const [localLogistics, setLocalLogistics] = useState('91');
  const [laborCost, setLaborCost] = useState('50');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxInfo, setTaxInfo] = useState('');

  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [customResources, setCustomResources] = useState<string[]>([]);
  const [newResource, setNewResource] = useState('');
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  
  // All roles from app_role enum
  const roles = ['admin', 'manager', 'management', 'driver', 'production', 'accounting', 'logistics', 'hr', 'interim'];
  const defaultResources = ['dashboard', 'orders', 'data', 'logistics', 'production', 'analytics', 'settings', 'users'];
  const allResources = [...new Set([...defaultResources, ...customResources])];
  
  // Resource categories for organized display
  const resourceCategories = [
    { name: 'Core', resources: ['dashboard', 'settings', 'users'] },
    { name: 'Operations', resources: ['orders', 'logistics', 'production'] },
    { name: 'Data & Analytics', resources: ['data', 'analytics'] },
    { name: 'Custom', resources: customResources },
  ];

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    loadSettings();
    loadPermissions();
    loadCompanyInfo();
  }, [isAdmin, navigate]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .in('key', ['freight_exterior_tariff', 'freight_local_tariff', 'usd_to_xcg_rate', 'company_info', 'local_logistics_usd', 'labor_xcg']);

      if (error) throw error;

      data?.forEach((setting) => {
        const value = setting.value as any;
        if (setting.key === 'freight_exterior_tariff') {
          setExteriorRate(value?.rate?.toString() || '0');
        } else if (setting.key === 'freight_local_tariff') {
          setLocalRate(value?.rate?.toString() || '0');
        } else if (setting.key === 'usd_to_xcg_rate') {
          setCurrencyRate(value?.rate?.toString() || '1.82');
        } else if (setting.key === 'local_logistics_usd') {
          setLocalLogistics(value?.toString() || '91');
        } else if (setting.key === 'labor_xcg') {
          setLaborCost(value?.toString() || '50');
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
      
      // Extract any custom resources from existing permissions
      const existingResources = [...new Set(data?.map(p => p.resource) || [])];
      const customOnes = existingResources.filter(r => !defaultResources.includes(r));
      setCustomResources(customOnes);
    } catch (error: any) {
      toast.error('Failed to load permissions');
    }
  };

  const loadCompanyInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'company_info')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.value) {
        const info = data.value as any;
        setCompanyName(info.company_name || '');
        setLogoUrl(info.logo_url || '');
        setAddressLine1(info.address_line1 || '');
        setAddressLine2(info.address_line2 || '');
        setCity(info.city || '');
        setPostalCode(info.postal_code || '');
        setPhone(info.phone || '');
        setEmail(info.email || '');
        setTaxInfo(info.tax_info || '');
      }
    } catch (error: any) {
      console.error('Failed to load company info:', error);
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
        },
        {
          key: 'local_logistics_usd',
          value: parseFloat(localLogistics),
          description: 'Local logistics cost per shipment in USD (trucking, warehousing, handling)'
        },
        {
          key: 'labor_xcg',
          value: parseFloat(laborCost),
          description: 'Labor cost per shipment in XCG (packing, handling, distributed equally across products)'
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

  const handleSaveCompanyInfo = async () => {
    setSaving(true);
    try {
      const companyData = {
        company_name: companyName,
        logo_url: logoUrl,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city: city,
        postal_code: postalCode,
        phone: phone,
        email: email,
        tax_info: taxInfo
      };

      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'company_info',
          value: companyData,
          description: 'Company information for receipts and documents'
        }, { onConflict: 'key' });

      if (error) throw error;

      toast.success('Company information saved successfully');
    } catch (error: any) {
      toast.error('Failed to save company information');
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


  const handleAddResource = () => {
    const resourceName = newResource.trim().toLowerCase().replace(/\s+/g, '_');
    if (!resourceName) {
      toast.error('Please enter a resource name');
      return;
    }
    if (allResources.includes(resourceName)) {
      toast.error('Resource already exists');
      return;
    }
    setCustomResources(prev => [...prev, resourceName]);
    setNewResource('');
    toast.success(`Resource "${resourceName}" added`);
  };

  const handleDeleteResource = async (resource: string) => {
    try {
      // Delete all permissions for this resource from database
      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('resource', resource);

      if (error) throw error;

      // Update local state
      setRolePermissions(prev => prev.filter(p => p.resource !== resource));
      setCustomResources(prev => prev.filter(r => r !== resource));
      toast.success(`Resource "${resource}" deleted`);
    } catch (error: any) {
      toast.error('Failed to delete resource');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6">
          <CardContent className="py-4 space-y-2">
            <Link to="/admin/integrations">
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Plug className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Integrations</p>
                    <p className="text-sm text-muted-foreground">Connect QuickBooks, WhatsApp, and other services</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
            <Link to="/import/standing-orders">
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Standing Orders</p>
                    <p className="text-sm text-muted-foreground">Manage recurring order templates for each delivery day</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
        <Tabs defaultValue="tariffs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tariffs">Currency & Tariffs</TabsTrigger>
            <TabsTrigger value="company">Company Information</TabsTrigger>
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
                  <div className="space-y-2">
                    <Label htmlFor="localLogistics">Local Logistics Cost (USD)</Label>
                    <Input
                      id="localLogistics"
                      type="number"
                      step="0.01"
                      value={localLogistics}
                      onChange={(e) => setLocalLogistics(e.target.value)}
                      placeholder="91.00"
                    />
                    <p className="text-sm text-muted-foreground">Per shipment (trucking, warehousing, handling)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="laborCost">Labor Cost (XCG)</Label>
                    <Input
                      id="laborCost"
                      type="number"
                      step="0.01"
                      value={laborCost}
                      onChange={(e) => setLaborCost(e.target.value)}
                      placeholder="50.00"
                    />
                    <p className="text-sm text-muted-foreground">Per shipment (packing, handling, distributed equally)</p>
                  </div>
                </div>
                <Button onClick={handleSaveTariffs} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Configure your company details for receipts and documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Your Company Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logoUrl">Company Logo URL</Label>
                    <Input
                      id="logoUrl"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                    />
                    <p className="text-sm text-muted-foreground">Upload your logo to an image hosting service and paste the URL here</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addressLine1">Address Line 1</Label>
                    <Input
                      id="addressLine1"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="123 Main Street"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
                    <Input
                      id="addressLine2"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder="Suite 100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="12345"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1-xxx-xxx-xxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="info@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxInfo">Business Registration / Tax Information (Optional)</Label>
                    <Textarea
                      id="taxInfo"
                      value={taxInfo}
                      onChange={(e) => setTaxInfo(e.target.value)}
                      placeholder="Tax ID: xxxxx"
                      rows={3}
                    />
                  </div>
                </div>
                <Button onClick={handleSaveCompanyInfo} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Company Information
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle>Role Permissions</CardTitle>
                <CardDescription>
                  Configure what each role can access. Click on a role to expand and modify permissions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search and Add Resource */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search roles..."
                      value={roleSearchQuery}
                      onChange={(e) => setRoleSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newResource}
                      onChange={(e) => setNewResource(e.target.value)}
                      placeholder="New resource name..."
                      className="w-48"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddResource()}
                    />
                    <Button onClick={handleAddResource} size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>

                {/* Custom Resources List */}
                {customResources.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium text-muted-foreground mr-2">Custom resources:</span>
                    {customResources.map(resource => (
                      <AlertDialog key={resource}>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1">
                            {resource.replace(/_/g, ' ')}
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Resource</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will delete the "{resource}" resource and all its permissions for all roles.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteResource(resource)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ))}
                  </div>
                )}

                {/* Role Permission Cards */}
                <div className="space-y-3">
                  {roles
                    .filter(role => role.toLowerCase().includes(roleSearchQuery.toLowerCase()))
                    .map(role => (
                      <RolePermissionCard
                        key={role}
                        role={role}
                        permissions={rolePermissions.filter(p => p.role === role)}
                        allResources={allResources}
                        resourceCategories={resourceCategories}
                        onPermissionChange={handlePermissionChange}
                        isAdmin={role === 'admin'}
                      />
                    ))}
                </div>
                
                <p className="text-sm text-muted-foreground text-center">
                  {roles.length} roles • {allResources.length} resources • {roles.length * allResources.length * 4} total permissions
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
