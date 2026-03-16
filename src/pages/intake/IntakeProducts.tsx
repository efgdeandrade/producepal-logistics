import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, ChevronDown, Pencil } from 'lucide-react';

const UNIT_OPTIONS = ['kg', 'case', 'bag', 'piece', 'box', 'lb', 'bunch', 'punnet'];

const SEED_PRODUCTS = [
  { name: 'Mango', name_aliases: ['mango'], unit_options: ['kg', 'case', 'piece'] },
  { name: 'Pumpkin', name_aliases: ['pampuna', 'pompoen', 'calabaza'], unit_options: ['kg', 'case', 'piece'] },
  { name: 'Pepper', name_aliases: ['peper', 'pepper', 'pimiento'], unit_options: ['kg', 'case', 'bag'] },
  { name: 'Tomato', name_aliases: ['tomaat', 'tomate'], unit_options: ['kg', 'case', 'bag'] },
  { name: 'Papaya', name_aliases: ['papaja', 'lechoza'], unit_options: ['kg', 'piece'] },
  { name: 'Watermelon', name_aliases: ['watermeloen', 'sandia', 'patia'], unit_options: ['kg', 'piece'] },
  { name: 'Cucumber', name_aliases: ['komkommer', 'pepino'], unit_options: ['kg', 'case', 'bag'] },
  { name: 'Lettuce', name_aliases: ['sla', 'lechuga'], unit_options: ['kg', 'case', 'bag'] },
  { name: 'Strawberry', name_aliases: ['fresa', 'aardbei'], unit_options: ['kg', 'punnet'] },
  { name: 'Pineapple', name_aliases: ['pina', 'ananas', 'piña'], unit_options: ['kg', 'piece', 'case'] },
];

export default function IntakeProducts() {
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [slideOpen, setSlideOpen] = useState(false);

  // Form
  const [formName, setFormName] = useState('');
  const [formAliases, setFormAliases] = useState<string[]>([]);
  const [formAliasInput, setFormAliasInput] = useState('');
  const [formUnitOptions, setFormUnitOptions] = useState<string[]>([]);
  const [formPrice, setFormPrice] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [formCaseLength, setFormCaseLength] = useState<number | ''>('');
  const [formCaseWidth, setFormCaseWidth] = useState<number | ''>('');
  const [formCaseHeight, setFormCaseHeight] = useState<number | ''>('');
  const [formGrossWeight, setFormGrossWeight] = useState<number | ''>('');
  const [formUnitsPerCase, setFormUnitsPerCase] = useState<number | ''>('');
  const [formUnitOfSale, setFormUnitOfSale] = useState('kg');
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase.from('distribution_products').select('*').order('name');
    if (!error && data) {
      // Seed if empty
      if (data.length === 0) {
        const seedRows = SEED_PRODUCTS.map((p, i) => ({
          name: p.name,
          code: p.name.toUpperCase().substring(0, 3) + '-' + String(i + 1).padStart(3, '0'),
          name_aliases: p.name_aliases,
          unit_options: p.unit_options,
          unit: p.unit_options[0] || 'kg',
          price_xcg: 0,
          is_active: true,
        }));
        await supabase.from('distribution_products').insert(seedRows);
        const { data: seeded } = await supabase.from('distribution_products').select('*').order('name');
        setProducts(seeded || []);
      } else {
        setProducts(data);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openAdd = () => {
    setEditProduct(null);
    setFormName('');
    setFormAliases([]);
    setFormAliasInput('');
    setFormUnitOptions(['kg']);
    setFormPrice(0);
    setFormActive(true);
    setFormCaseLength('');
    setFormCaseWidth('');
    setFormCaseHeight('');
    setFormGrossWeight('');
    setFormUnitsPerCase('');
    setFormUnitOfSale('kg');
    setSlideOpen(true);
  };

  const openEdit = (p: any) => {
    setEditProduct(p);
    setFormName(p.name);
    setFormAliases(p.name_aliases || []);
    setFormAliasInput('');
    setFormUnitOptions(p.unit_options || []);
    setFormPrice(p.price_xcg || 0);
    setFormActive(p.is_active ?? true);
    setFormCaseLength(p.case_length_cm ?? '');
    setFormCaseWidth(p.case_width_cm ?? '');
    setFormCaseHeight(p.case_height_cm ?? '');
    setFormGrossWeight(p.gross_weight_per_case_kg ?? '');
    setFormUnitsPerCase(p.units_per_case ?? '');
    setFormUnitOfSale(p.unit_of_sale || 'kg');
    setSlideOpen(true);
  };

  const addAlias = () => {
    const alias = formAliasInput.trim().toLowerCase();
    if (alias && !formAliases.includes(alias)) {
      setFormAliases([...formAliases, alias]);
    }
    setFormAliasInput('');
  };

  const removeAlias = (alias: string) => {
    setFormAliases(formAliases.filter((a) => a !== alias));
  };

  const toggleUnit = (unit: string) => {
    setFormUnitOptions(
      formUnitOptions.includes(unit) ? formUnitOptions.filter((u) => u !== unit) : [...formUnitOptions, unit]
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    setSaving(true);

    const payload: any = {
      name: formName.trim(),
      name_aliases: formAliases,
      unit_options: formUnitOptions,
      price_xcg: formPrice,
      is_active: formActive,
      unit: formUnitOptions[0] || 'kg',
      case_length_cm: formCaseLength || null,
      case_width_cm: formCaseWidth || null,
      case_height_cm: formCaseHeight || null,
      gross_weight_per_case_kg: formGrossWeight || null,
      units_per_case: formUnitsPerCase || null,
      unit_of_sale: formUnitOfSale,
    };

    if (editProduct) {
      await supabase.from('distribution_products').update(payload).eq('id', editProduct.id);
      toast({ title: 'Product updated' });
    } else {
      payload.code = formName.trim().toUpperCase().substring(0, 3) + '-' + Date.now().toString().slice(-4);
      await supabase.from('distribution_products').insert(payload);
      toast({ title: 'Product added' });
    }

    setSaving(false);
    setSlideOpen(false);
    fetchProducts();
  };

  const toggleActive = async (p: any) => {
    await supabase.from('distribution_products').update({ is_active: !p.is_active }).eq('id', p.id);
    fetchProducts();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-intake-text">Products</h1>
        <Button className="bg-intake-brand hover:bg-intake-accent text-white" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Product
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="border rounded-lg bg-intake-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Aliases</TableHead>
                <TableHead>Unit Options</TableHead>
                <TableHead>Price (XCG)</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">{p.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(p.name_aliases || []).map((a: string) => (
                        <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(p.unit_options || []).map((u: string) => (
                        <Badge key={u} variant="outline" className="text-[10px]">{u}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{p.price_xcg?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell>
                    <Switch checked={p.is_active ?? true} onCheckedChange={() => toggleActive(p)} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Sheet */}
      <Sheet open={slideOpen} onOpenChange={setSlideOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editProduct ? 'Edit Product' : 'Add Product'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>

            <div>
              <Label>Aliases</Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {formAliases.map((a) => (
                  <Badge key={a} variant="secondary" className="text-xs gap-1">
                    {a}
                    <button onClick={() => removeAlias(a)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={formAliasInput}
                  onChange={(e) => setFormAliasInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAlias(); } }}
                  placeholder="Type alias and press Enter"
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={addAlias}>Add</Button>
              </div>
            </div>

            <div>
              <Label>Unit Options</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {UNIT_OPTIONS.map((u) => (
                  <label key={u} className="flex items-center gap-1.5 text-xs">
                    <Checkbox checked={formUnitOptions.includes(u)} onCheckedChange={() => toggleUnit(u)} />
                    {u}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Standard Price Per Unit (XCG)</Label>
              <Input type="number" step="0.01" value={formPrice} onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)} />
            </div>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between h-8 text-xs">
                  Import Details <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Length (cm)</Label>
                    <Input type="number" value={formCaseLength} onChange={(e) => setFormCaseLength(parseFloat(e.target.value) || '')} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input type="number" value={formCaseWidth} onChange={(e) => setFormCaseWidth(parseFloat(e.target.value) || '')} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input type="number" value={formCaseHeight} onChange={(e) => setFormCaseHeight(parseFloat(e.target.value) || '')} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Gross Weight/Case (kg)</Label>
                    <Input type="number" value={formGrossWeight} onChange={(e) => setFormGrossWeight(parseFloat(e.target.value) || '')} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Units/Case</Label>
                    <Input type="number" value={formUnitsPerCase} onChange={(e) => setFormUnitsPerCase(parseInt(e.target.value) || '')} className="h-8 text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Unit of Sale</Label>
                  <div className="flex gap-3 mt-1">
                    {['kg', 'bunch', 'piece'].map((u) => (
                      <label key={u} className="flex items-center gap-1 text-xs">
                        <input type="radio" name="unitOfSale" checked={formUnitOfSale === u} onChange={() => setFormUnitOfSale(u)} />
                        {u}
                      </label>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex items-center gap-2">
              <Label>Active</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>

            <Button className="w-full bg-intake-brand hover:bg-intake-accent text-white" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
