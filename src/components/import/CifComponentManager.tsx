import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Plus, Trash2, Check, Clock, FileCheck, Settings2, AlertTriangle } from "lucide-react";
import { type CifComponent, COMPONENT_TYPES, DEFAULT_ALLOCATION_BASIS } from "@/lib/cifEngine";

interface CifComponentManagerProps {
  components: CifComponent[];
  onChange: (components: CifComponent[]) => void;
  versionType: 'estimate' | 'actual';
  chargeableWeightKg?: number;
  defaultSettings?: {
    champion_cost_per_kg: number;
    swissport_cost_per_kg: number;
    bank_charges_usd: number;
    local_logistics_xcg: number;
  };
}

export function CifComponentManager({
  components,
  onChange,
  versionType,
  chargeableWeightKg = 0,
  defaultSettings,
}: CifComponentManagerProps) {
  const addComponent = (type: string) => {
    const comp: CifComponent = {
      component_type: type,
      label: COMPONENT_TYPES.find(t => t.value === type)?.label || type,
      status: versionType === 'estimate' ? 'received' : 'pending',
      currency: 'USD',
      amount: 0,
      allocation_basis: DEFAULT_ALLOCATION_BASIS[type] || 'equal',
    };
    onChange([...components, comp]);
  };

  const removeComponent = (index: number) => {
    onChange(components.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: string, value: any) => {
    onChange(components.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const addDefaults = () => {
    if (!defaultSettings) return;
    const defaults: CifComponent[] = [
      { component_type: 'air_freight', label: 'Air Freight', status: versionType === 'estimate' ? 'received' : 'pending', currency: 'USD', amount: 0, allocation_basis: 'chargeable_weight' },
      { component_type: 'champion', label: 'Champion', status: versionType === 'estimate' ? 'received' : 'pending', currency: 'USD', amount: defaultSettings.champion_cost_per_kg * chargeableWeightKg, allocation_basis: 'chargeable_weight' },
      { component_type: 'swissport', label: 'Swissport', status: versionType === 'estimate' ? 'received' : 'pending', currency: 'USD', amount: defaultSettings.swissport_cost_per_kg * chargeableWeightKg, allocation_basis: 'chargeable_weight' },
      { component_type: 'bank_charges', label: 'Bank Charges', status: versionType === 'estimate' ? 'received' : 'pending', currency: 'USD', amount: defaultSettings.bank_charges_usd, allocation_basis: 'value' },
      { component_type: 'handling_terminal', label: 'Local Logistics', status: versionType === 'estimate' ? 'received' : 'pending', currency: 'XCG', amount: defaultSettings.local_logistics_xcg, allocation_basis: 'cases' },
    ];
    onChange(defaults);
  };

  const pendingCount = components.filter(c => c.status === 'pending').length;
  const allApproved = components.length > 0 && components.every(c => c.status === 'approved');

  const statusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <Check className="h-3 w-3 text-green-600" />;
      case 'received': return <FileCheck className="h-3 w-3 text-blue-600" />;
      default: return <Clock className="h-3 w-3 text-amber-600" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-600 text-xs h-5">{statusIcon(status)} Approved</Badge>;
      case 'received': return <Badge className="bg-blue-600 text-xs h-5">{statusIcon(status)} Received</Badge>;
      default: return <Badge variant="secondary" className="text-xs h-5">{statusIcon(status)} Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <CardTitle className="text-base">Cost Components</CardTitle>
            {versionType === 'actual' && pendingCount > 0 && (
              <Badge variant="outline" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
                {pendingCount} pending
              </Badge>
            )}
            {versionType === 'actual' && allApproved && (
              <Badge className="bg-green-600 text-xs">FINAL</Badge>
            )}
          </div>
          <div className="flex gap-2">
            {defaultSettings && (
              <Button variant="outline" size="sm" onClick={addDefaults}>
                <Settings2 className="h-4 w-4 mr-1" />
                Auto-Fill
              </Button>
            )}
            <Select onValueChange={addComponent}>
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue placeholder="Add cost..." />
              </SelectTrigger>
              <SelectContent>
                {COMPONENT_TYPES.map(ct => (
                  <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {components.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Add cost components or use Auto-Fill
          </div>
        ) : (
          <div className="space-y-2">
            {components.map((comp, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{comp.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {comp.allocation_basis.replace(/_/g, ' ')}
                  </div>
                </div>

                {versionType === 'actual' && (
                  <Select
                    value={comp.status}
                    onValueChange={v => updateComponent(idx, 'status', v)}
                  >
                    <SelectTrigger className="w-[110px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <Select value={comp.currency} onValueChange={v => updateComponent(idx, 'currency', v)}>
                  <SelectTrigger className="w-[70px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="XCG">XCG</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  step="0.01"
                  value={comp.amount}
                  onChange={e => updateComponent(idx, 'amount', parseFloat(e.target.value) || 0)}
                  className="w-[100px] h-7 text-xs"
                />

                <Select value={comp.allocation_basis} onValueChange={v => updateComponent(idx, 'allocation_basis', v)}>
                  <SelectTrigger className="w-[120px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chargeable_weight">Chrg Wt</SelectItem>
                    <SelectItem value="actual_weight">Actual Wt</SelectItem>
                    <SelectItem value="volume">Volume</SelectItem>
                    <SelectItem value="value">Value</SelectItem>
                    <SelectItem value="cases">Cases</SelectItem>
                    <SelectItem value="pieces">Pieces</SelectItem>
                    <SelectItem value="equal">Equal</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeComponent(idx)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
