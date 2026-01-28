import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SupplierPricingSection, SupplierPriceEntry } from '@/components/SupplierPricingSection';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

interface ProductFormData {
  code: string;
  name: string;
  pack_size: string;
  supplier_id: string;
  case_size: string;
  consolidation_group: string;
  netto_weight_per_unit: string;
  gross_weight_per_unit: string;
  empty_case_weight: string;
  price_usd_per_unit: string;
  price_usd_per_case: string;
  price_xcg_per_unit: string;
  price_xcg_per_case: string;
  wholesale_price_usd_per_unit: string;
  wholesale_price_xcg_per_unit: string;
  retail_price_usd_per_unit: string;
  retail_price_xcg_per_unit: string;
  unit: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  pack_size: number;
  supplier_id?: string | null;
  case_size?: string | null;
  consolidation_group?: string | null;
  netto_weight_per_unit?: number | null;
  gross_weight_per_unit?: number | null;
  empty_case_weight?: number | null;
  price_usd_per_unit?: number | null;
  price_xcg_per_unit?: number | null;
  wholesale_price_usd_per_unit?: number | null;
  wholesale_price_xcg_per_unit?: number | null;
  retail_price_usd_per_unit?: number | null;
  retail_price_xcg_per_unit?: number | null;
  unit?: string | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  volumetric_weight_kg?: number | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface ProductFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Product | null;
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
  suppliers: Supplier[];
  currencyRate: number;
  setCurrencyRate: (rate: number) => void;
  onSave: () => void;
  canManage: boolean;
  supplierPrices?: SupplierPriceEntry[];
  onSupplierPricesChange?: (prices: SupplierPriceEntry[]) => void;
}

export const ProductFormDialog = ({
  isOpen,
  onOpenChange,
  editingProduct,
  formData,
  setFormData,
  suppliers,
  currencyRate,
  setCurrencyRate,
  onSave,
  canManage,
  supplierPrices = [],
  onSupplierPricesChange = () => {},
}: ProductFormDialogProps) => {
  // Calculate volumetric weight when dimensions change
  const volumetricWeight = formData.length_cm && formData.width_cm && formData.height_cm
    ? (parseFloat(formData.length_cm) * parseFloat(formData.width_cm) * parseFloat(formData.height_cm)) / 6000
    : 0;

  if (!canManage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="code">Product Code *</Label>
                {!editingProduct && formData.code.startsWith('IMP-') && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Sparkles className="h-3 w-3" />
                    Auto-generated
                  </Badge>
                )}
              </div>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., IMP-003510"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Blueberries 125g"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Unit Type *</Label>
              <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Select unit type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilogram (kg)</SelectItem>
                  <SelectItem value="g">Gram (g)</SelectItem>
                  <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                  <SelectItem value="oz">Ounce (oz)</SelectItem>
                  <SelectItem value="lb">Pound (lb)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pack_size">Units/Case *</Label>
              <Input
                id="pack_size"
                type="number"
                value={formData.pack_size}
                onChange={(e) => {
                  const newPackSize = e.target.value;
                  const packSizeNum = parseFloat(newPackSize) || 1;
                  const pricePerUnit = parseFloat(formData.price_usd_per_unit) || 0;
                  const pricePerUnitXcg = parseFloat(formData.price_xcg_per_unit) || 0;
                  setFormData({ 
                    ...formData, 
                    pack_size: newPackSize,
                    price_usd_per_case: pricePerUnit ? (pricePerUnit * packSizeNum).toFixed(2) : '',
                    price_xcg_per_case: pricePerUnitXcg ? (pricePerUnitXcg * packSizeNum).toFixed(2) : ''
                  });
                }}
                placeholder="12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
              >
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="consolidation_group">Consolidation Group</Label>
            <Input
              id="consolidation_group"
              value={formData.consolidation_group}
              onChange={(e) => setFormData({ ...formData, consolidation_group: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
              placeholder="e.g., BABY_GREENS_150G"
            />
            <p className="text-xs text-muted-foreground">
              Products in the same consolidation group with matching pack sizes will be combined when ordering from suppliers
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="netto_weight_per_unit">
                Net Weight/Unit (g)
              </Label>
              <Input
                id="netto_weight_per_unit"
                type="number"
                step="0.01"
                value={formData.netto_weight_per_unit}
                onChange={(e) => setFormData({ ...formData, netto_weight_per_unit: e.target.value })}
                placeholder="Net weight in grams"
              />
              <p className="text-xs text-muted-foreground">
                Used if Gross Weight is empty
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gross_weight_per_unit">
                Gross Weight/Unit (g)
              </Label>
              <Input
                id="gross_weight_per_unit"
                type="number"
                step="0.01"
                value={formData.gross_weight_per_unit}
                onChange={(e) => setFormData({ ...formData, gross_weight_per_unit: e.target.value })}
                placeholder="Gross weight in grams"
              />
              <p className="text-xs text-muted-foreground">
                Overrides Net Weight when filled
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="empty_case_weight">Empty Case Weight (g)</Label>
              <Input
                id="empty_case_weight"
                type="number"
                step="0.01"
                value={formData.empty_case_weight}
                onChange={(e) => setFormData({ ...formData, empty_case_weight: e.target.value })}
                placeholder="Empty case weight in grams"
              />
              <p className="text-xs text-muted-foreground">
                Weight of empty case/tray only
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Cost Price (Supplier)</h4>
              <div className="flex items-center gap-2">
                <Label htmlFor="currency_rate" className="text-xs text-muted-foreground">Currency Rate (USD to Cg):</Label>
                <Input
                  id="currency_rate"
                  type="number"
                  step="0.01"
                  value={currencyRate}
                  onChange={(e) => setCurrencyRate(parseFloat(e.target.value) || 1.82)}
                  className="w-20 h-8 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price_usd_per_unit">USD Per Unit</Label>
                <Input
                  id="price_usd_per_unit"
                  type="number"
                  step="0.01"
                  value={formData.price_usd_per_unit}
                  onChange={(e) => {
                    const usdPerUnit = parseFloat(e.target.value) || 0;
                    const xcgPerUnit = usdPerUnit * currencyRate;
                    const packSize = parseFloat(formData.pack_size) || 1;
                    const usdPerCase = usdPerUnit * packSize;
                    const xcgPerCase = xcgPerUnit * packSize;
                    setFormData({
                      ...formData,
                      price_usd_per_unit: e.target.value,
                      price_xcg_per_unit: xcgPerUnit ? xcgPerUnit.toFixed(4) : '',
                      price_usd_per_case: usdPerCase ? usdPerCase.toFixed(4) : '',
                      price_xcg_per_case: xcgPerCase ? xcgPerCase.toFixed(4) : '',
                    });
                  }}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_usd_per_case">USD Per Case</Label>
                <Input
                  id="price_usd_per_case"
                  type="number"
                  step="0.01"
                  value={formData.price_usd_per_case}
                  onChange={(e) => {
                    const usdPerCase = parseFloat(e.target.value) || 0;
                    const packSize = parseFloat(formData.pack_size) || 1;
                    const usdPerUnit = packSize > 0 ? usdPerCase / packSize : 0;
                    const xcgPerUnit = usdPerUnit * currencyRate;
                    const xcgPerCase = usdPerCase * currencyRate;
                    setFormData({
                      ...formData,
                      price_usd_per_case: e.target.value,
                      price_usd_per_unit: usdPerUnit ? usdPerUnit.toFixed(4) : '',
                      price_xcg_per_unit: xcgPerUnit ? xcgPerUnit.toFixed(4) : '',
                      price_xcg_per_case: xcgPerCase ? xcgPerCase.toFixed(4) : '',
                    });
                  }}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price_xcg_per_unit">Cg Per Unit</Label>
                <Input
                  id="price_xcg_per_unit"
                  type="number"
                  step="0.01"
                  value={formData.price_xcg_per_unit}
                  onChange={(e) => {
                    const xcgPerUnit = parseFloat(e.target.value) || 0;
                    const usdPerUnit = currencyRate > 0 ? xcgPerUnit / currencyRate : 0;
                    const packSize = parseFloat(formData.pack_size) || 1;
                    const xcgPerCase = xcgPerUnit * packSize;
                    const usdPerCase = usdPerUnit * packSize;
                    setFormData({
                      ...formData,
                      price_xcg_per_unit: e.target.value,
                      price_usd_per_unit: usdPerUnit ? usdPerUnit.toFixed(4) : '',
                      price_xcg_per_case: xcgPerCase ? xcgPerCase.toFixed(4) : '',
                      price_usd_per_case: usdPerCase ? usdPerCase.toFixed(4) : '',
                    });
                  }}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_xcg_per_case">Cg Per Case</Label>
                <Input
                  id="price_xcg_per_case"
                  type="number"
                  step="0.01"
                  value={formData.price_xcg_per_case}
                  onChange={(e) => {
                    const xcgPerCase = parseFloat(e.target.value) || 0;
                    const packSize = parseFloat(formData.pack_size) || 1;
                    const xcgPerUnit = packSize > 0 ? xcgPerCase / packSize : 0;
                    const usdPerUnit = currencyRate > 0 ? xcgPerUnit / currencyRate : 0;
                    const usdPerCase = currencyRate > 0 ? xcgPerCase / currencyRate : 0;
                    setFormData({
                      ...formData,
                      price_xcg_per_case: e.target.value,
                      price_xcg_per_unit: xcgPerUnit ? xcgPerUnit.toFixed(4) : '',
                      price_usd_per_unit: usdPerUnit ? usdPerUnit.toFixed(4) : '',
                      price_usd_per_case: usdPerCase ? usdPerCase.toFixed(4) : '',
                    });
                  }}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Multi-Supplier Pricing Section */}
          <SupplierPricingSection
            supplierPrices={supplierPrices}
            onSupplierPricesChange={onSupplierPricesChange}
            suppliers={suppliers}
            currencyRate={currencyRate}
          />

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Wholesale Price</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wholesale_price_usd_per_unit">USD Per Unit</Label>
                <Input
                  id="wholesale_price_usd_per_unit"
                  type="number"
                  step="0.01"
                  value={formData.wholesale_price_usd_per_unit}
                  onChange={(e) => setFormData({ ...formData, wholesale_price_usd_per_unit: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wholesale_price_xcg_per_unit">Cg Per Unit</Label>
                <Input
                  id="wholesale_price_xcg_per_unit"
                  type="number"
                  step="0.01"
                  value={formData.wholesale_price_xcg_per_unit}
                  onChange={(e) => setFormData({ ...formData, wholesale_price_xcg_per_unit: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Retail Price</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="retail_price_usd_per_unit">USD Per Unit</Label>
                <Input
                  id="retail_price_usd_per_unit"
                  type="number"
                  step="0.01"
                  value={formData.retail_price_usd_per_unit}
                  onChange={(e) => setFormData({ ...formData, retail_price_usd_per_unit: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retail_price_xcg_per_unit">Cg Per Unit</Label>
                <Input
                  id="retail_price_xcg_per_unit"
                  type="number"
                  step="0.01"
                  value={formData.retail_price_xcg_per_unit}
                  onChange={(e) => setFormData({ ...formData, retail_price_xcg_per_unit: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">Case/Tray Dimensions</h4>
              <span className="text-xs text-muted-foreground">(Full case/tray, not individual units)</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="length_cm">Length (cm)</Label>
                <Input
                  id="length_cm"
                  type="number"
                  step="0.1"
                  value={formData.length_cm}
                  onChange={(e) => setFormData({ ...formData, length_cm: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width_cm">Width (cm)</Label>
                <Input
                  id="width_cm"
                  type="number"
                  step="0.1"
                  value={formData.width_cm}
                  onChange={(e) => setFormData({ ...formData, width_cm: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height_cm">Height (cm)</Label>
                <Input
                  id="height_cm"
                  type="number"
                  step="0.1"
                  value={formData.height_cm}
                  onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            {volumetricWeight > 0 && formData.pack_size && (
              <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Volumetric Weight (per case):</span>
                  <span className="font-medium">{volumetricWeight.toFixed(3)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Volumetric Weight (per unit):</span>
                  <span className="font-medium">{(volumetricWeight / parseInt(formData.pack_size || '1')).toFixed(4)} kg</span>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Formula: (L × W × H) ÷ 6000 for airfreight
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            {editingProduct ? 'Update' : 'Add'} Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
