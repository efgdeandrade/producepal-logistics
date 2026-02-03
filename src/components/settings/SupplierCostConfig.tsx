import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, DollarSign, Truck, Building2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SupplierCostConfigData {
  id?: string;
  supplier_id: string;
  supplier_name: string;
  fixed_cost_per_shipment_usd: number;
  handling_notes: string;
  is_active: boolean;
}

export function SupplierCostConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierCostConfigData[]>([]);
  const [defaultBankCharges, setDefaultBankCharges] = useState('0');
  const [defaultLaborCost, setDefaultLaborCost] = useState('50');
  const [defaultLocalLogistics, setDefaultLocalLogistics] = useState('91');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Fetch suppliers and their cost configs in parallel
      const [suppliersRes, configsRes, settingsRes] = await Promise.all([
        supabase.from('suppliers').select('id, name').order('name'),
        supabase.from('supplier_cost_config').select('*'),
        supabase.from('settings').select('*').in('key', [
          'default_bank_charges_usd', 
          'labor_xcg', 
          'local_logistics_usd'
        ])
      ]);

      if (suppliersRes.error) throw suppliersRes.error;

      // Parse settings
      settingsRes.data?.forEach(setting => {
        const value = setting.value as any;
        if (setting.key === 'default_bank_charges_usd') {
          setDefaultBankCharges(value?.toString() || '0');
        } else if (setting.key === 'labor_xcg') {
          setDefaultLaborCost(value?.toString() || '50');
        } else if (setting.key === 'local_logistics_usd') {
          setDefaultLocalLogistics(value?.toString() || '91');
        }
      });

      // Merge suppliers with their cost configs
      const configMap = new Map(
        (configsRes.data || []).map(c => [c.supplier_id, c])
      );

      const mergedSuppliers: SupplierCostConfigData[] = (suppliersRes.data || []).map(supplier => {
        const config = configMap.get(supplier.id);
        return {
          id: config?.id,
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          fixed_cost_per_shipment_usd: config?.fixed_cost_per_shipment_usd || 0,
          handling_notes: config?.handling_notes || '',
          is_active: config?.is_active ?? true,
        };
      });

      setSuppliers(mergedSuppliers);
    } catch (error: any) {
      console.error('Error loading supplier costs:', error);
      toast.error('Failed to load supplier cost configuration');
    } finally {
      setLoading(false);
    }
  };

  const updateSupplierConfig = (supplierId: string, field: keyof SupplierCostConfigData, value: any) => {
    setSuppliers(prev => prev.map(s => 
      s.supplier_id === supplierId ? { ...s, [field]: value } : s
    ));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Save default settings
      const settingsUpdates = [
        {
          key: 'default_bank_charges_usd',
          value: parseFloat(defaultBankCharges) || 0,
          description: 'Default bank/wire transfer charges per shipment in USD'
        },
        {
          key: 'labor_xcg',
          value: parseFloat(defaultLaborCost) || 50,
          description: 'Labor cost per shipment in XCG'
        },
        {
          key: 'local_logistics_usd',
          value: parseFloat(defaultLocalLogistics) || 91,
          description: 'Local logistics cost per shipment in USD'
        }
      ];

      for (const update of settingsUpdates) {
        const { error } = await supabase
          .from('settings')
          .upsert(update, { onConflict: 'key' });
        if (error) throw error;
      }

      // Upsert supplier cost configs
      const configsToSave = suppliers
        .filter(s => s.fixed_cost_per_shipment_usd > 0 || s.handling_notes || s.id)
        .map(s => ({
          id: s.id || undefined,
          supplier_id: s.supplier_id,
          fixed_cost_per_shipment_usd: s.fixed_cost_per_shipment_usd,
          handling_notes: s.handling_notes,
          is_active: s.is_active,
        }));

      if (configsToSave.length > 0) {
        const { error } = await supabase
          .from('supplier_cost_config')
          .upsert(configsToSave, { onConflict: 'supplier_id' });
        if (error) throw error;
      }

      toast.success('Import cost configuration saved successfully');
      loadData(); // Reload to get any new IDs
    } catch (error: any) {
      console.error('Error saving supplier costs:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const totalFixedCosts = suppliers
    .filter(s => s.is_active)
    .reduce((sum, s) => sum + s.fixed_cost_per_shipment_usd, 0);

  return (
    <div className="space-y-6">
      {/* Default Costs Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Default Import Costs
          </CardTitle>
          <CardDescription>
            Configure default costs applied to all CIF calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="localLogistics" className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Local Logistics (USD)
              </Label>
              <Input
                id="localLogistics"
                type="number"
                step="0.01"
                value={defaultLocalLogistics}
                onChange={(e) => setDefaultLocalLogistics(e.target.value)}
                placeholder="91.00"
              />
              <p className="text-xs text-muted-foreground">
                Trucking, warehousing, handling per shipment
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="laborCost" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Labor Cost (XCG)
              </Label>
              <Input
                id="laborCost"
                type="number"
                step="0.01"
                value={defaultLaborCost}
                onChange={(e) => setDefaultLaborCost(e.target.value)}
                placeholder="50.00"
              />
              <p className="text-xs text-muted-foreground">
                Packing and handling, distributed equally
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bankCharges" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Bank Charges (USD)
              </Label>
              <Input
                id="bankCharges"
                type="number"
                step="0.01"
                value={defaultBankCharges}
                onChange={(e) => setDefaultBankCharges(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Wire transfer and currency fees
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Fixed Costs Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Supplier Fixed Costs
              </CardTitle>
              <CardDescription>
                Configure fixed costs per shipment for each import supplier
              </CardDescription>
            </div>
            {totalFixedCosts > 0 && (
              <Badge variant="secondary" className="text-sm">
                Total Active: ${totalFixedCosts.toFixed(2)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No suppliers configured yet.</p>
              <p className="text-sm">Add suppliers in the Products section to configure their costs.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="w-32">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1">
                            Fixed Cost (USD)
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Flat fee added per shipment from this supplier</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="min-w-[200px]">Notes</TableHead>
                    <TableHead className="w-20 text-center">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.supplier_id}>
                      <TableCell className="font-medium">
                        {supplier.supplier_name}
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="pl-7 w-24"
                            value={supplier.fixed_cost_per_shipment_usd || ''}
                            onChange={(e) => updateSupplierConfig(
                              supplier.supplier_id,
                              'fixed_cost_per_shipment_usd',
                              parseFloat(e.target.value) || 0
                            )}
                            placeholder="0.00"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Textarea
                          className="min-h-[36px] resize-none"
                          rows={1}
                          value={supplier.handling_notes}
                          onChange={(e) => updateSupplierConfig(
                            supplier.supplier_id,
                            'handling_notes',
                            e.target.value
                          )}
                          placeholder="e.g., Documentation handling, packaging..."
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={supplier.is_active}
                          onCheckedChange={(checked) => updateSupplierConfig(
                            supplier.supplier_id,
                            'is_active',
                            checked
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary and Save */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <p>These costs will be automatically included in CIF estimates for import orders.</p>
        </div>
        <Button onClick={handleSaveAll} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save All Configuration
        </Button>
      </div>
    </div>
  );
}
