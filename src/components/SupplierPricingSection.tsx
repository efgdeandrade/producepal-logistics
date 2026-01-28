import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, X, ChevronDown, ChevronUp, Truck } from 'lucide-react';

export interface SupplierPriceEntry {
  id: string;
  supplier_id: string;
  cost_price_usd: string;
  cost_price_xcg: string;
  lead_time_days: string;
  min_order_qty: string;
  notes: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface SupplierPricingSectionProps {
  supplierPrices: SupplierPriceEntry[];
  onSupplierPricesChange: (prices: SupplierPriceEntry[]) => void;
  suppliers: Supplier[];
  currencyRate: number;
}

export const SupplierPricingSection = ({
  supplierPrices,
  onSupplierPricesChange,
  suppliers,
  currencyRate,
}: SupplierPricingSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const addSupplierEntry = () => {
    const newEntry: SupplierPriceEntry = {
      id: Date.now().toString(),
      supplier_id: '',
      cost_price_usd: '',
      cost_price_xcg: '',
      lead_time_days: '',
      min_order_qty: '',
      notes: '',
    };
    onSupplierPricesChange([...supplierPrices, newEntry]);
  };

  const removeSupplierEntry = (id: string) => {
    onSupplierPricesChange(supplierPrices.filter(sp => sp.id !== id));
  };

  const updateSupplierEntry = (id: string, field: keyof SupplierPriceEntry, value: string) => {
    onSupplierPricesChange(
      supplierPrices.map(sp => {
        if (sp.id !== id) return sp;

        // Auto-calculate XCG when USD changes
        if (field === 'cost_price_usd') {
          const usd = parseFloat(value) || 0;
          const xcg = usd * currencyRate;
          return {
            ...sp,
            cost_price_usd: value,
            cost_price_xcg: xcg ? xcg.toFixed(4) : '',
          };
        }

        // Auto-calculate USD when XCG changes
        if (field === 'cost_price_xcg') {
          const xcg = parseFloat(value) || 0;
          const usd = currencyRate > 0 ? xcg / currencyRate : 0;
          return {
            ...sp,
            cost_price_xcg: value,
            cost_price_usd: usd ? usd.toFixed(4) : '',
          };
        }

        return { ...sp, [field]: value };
      })
    );
  };

  // Get suppliers that are not already selected
  const getAvailableSuppliers = (currentEntryId: string) => {
    const selectedSupplierIds = supplierPrices
      .filter(sp => sp.id !== currentEntryId && sp.supplier_id)
      .map(sp => sp.supplier_id);
    return suppliers.filter(s => !selectedSupplierIds.includes(s.id));
  };

  const getSupplierName = (supplierId: string) => {
    return suppliers.find(s => s.id === supplierId)?.name || 'Select supplier';
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Supplier Pricing</h4>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              {supplierPrices.length > 0 && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {supplierPrices.length} supplier{supplierPrices.length !== 1 ? 's' : ''}
                </span>
              )}
            </Button>
          </CollapsibleTrigger>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSupplierEntry}
            className="h-8"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Supplier
          </Button>
        </div>

        <CollapsibleContent className="space-y-3">
          {supplierPrices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
              No supplier pricing added. Click "Add Supplier" to add pricing from different suppliers.
            </p>
          ) : (
            supplierPrices.map((entry, index) => (
              <div
                key={entry.id}
                className="border rounded-lg p-4 bg-muted/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Supplier {index + 1}
                    </span>
                    {entry.supplier_id && (
                      <span className="text-sm font-medium text-foreground">
                        - {getSupplierName(entry.supplier_id)}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSupplierEntry(entry.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label className="text-xs">Supplier *</Label>
                    <Select
                      value={entry.supplier_id}
                      onValueChange={(value) => updateSupplierEntry(entry.id, 'supplier_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableSuppliers(entry.id).map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Cost USD/Unit</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={entry.cost_price_usd}
                      onChange={(e) => updateSupplierEntry(entry.id, 'cost_price_usd', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Cost Cg/Unit</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={entry.cost_price_xcg}
                      onChange={(e) => updateSupplierEntry(entry.id, 'cost_price_xcg', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Lead Time (days)</Label>
                    <Input
                      type="number"
                      value={entry.lead_time_days}
                      onChange={(e) => updateSupplierEntry(entry.id, 'lead_time_days', e.target.value)}
                      placeholder="e.g., 3"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Min Order Qty</Label>
                    <Input
                      type="number"
                      value={entry.min_order_qty}
                      onChange={(e) => updateSupplierEntry(entry.id, 'min_order_qty', e.target.value)}
                      placeholder="e.g., 10"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
