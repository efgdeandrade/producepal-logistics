import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle2, HelpCircle, Scale } from 'lucide-react';

type Classification = 'unit_weight' | 'case_weight' | 'ambiguous';

interface ProductAnalysis {
  id: string;
  code: string;
  name: string;
  weight: number | null;
  netto_weight_per_unit: number | null;
  gross_weight_per_unit: number | null;
  empty_case_weight: number | null;
  pack_size: number;
  unit_net_g: number | null;
  case_gross_g: number | null;
  weight_mode: string | null;
  classification: Classification;
  proposed_unit_net_g: number | null;
  proposed_case_gross_g: number | null;
  proposed_weight_mode: string;
  reasoning: string;
  already_migrated: boolean;
}

function classifyProduct(p: any): ProductAnalysis {
  const weight = p.weight ? Number(p.weight) : null;
  const netto = p.netto_weight_per_unit ? Number(p.netto_weight_per_unit) : null;
  const gross = p.gross_weight_per_unit ? Number(p.gross_weight_per_unit) : null;
  const emptyCase = p.empty_case_weight ? Number(p.empty_case_weight) : null;
  const packSize = Number(p.pack_size) || 1;
  const alreadyMigrated = !!(p.unit_net_g || p.case_gross_g || p.weight_mode);

  // If already has new fields, skip
  if (alreadyMigrated) {
    return {
      id: p.id, code: p.code, name: p.name, weight, netto_weight_per_unit: netto,
      gross_weight_per_unit: gross, empty_case_weight: emptyCase, pack_size: packSize,
      unit_net_g: p.unit_net_g, case_gross_g: p.case_gross_g, weight_mode: p.weight_mode,
      classification: 'ambiguous', proposed_unit_net_g: null, proposed_case_gross_g: null,
      proposed_weight_mode: '', reasoning: 'Already migrated', already_migrated: true,
    };
  }

  // Best case: netto_weight_per_unit exists — it's clearly a per-unit weight
  if (netto && netto > 0 && packSize > 0) {
    const computedCaseGross = netto * packSize + (emptyCase || 0);
    return {
      id: p.id, code: p.code, name: p.name, weight, netto_weight_per_unit: netto,
      gross_weight_per_unit: gross, empty_case_weight: emptyCase, pack_size: packSize,
      unit_net_g: p.unit_net_g, case_gross_g: p.case_gross_g, weight_mode: p.weight_mode,
      classification: 'unit_weight',
      proposed_unit_net_g: netto,
      proposed_case_gross_g: computedCaseGross,
      proposed_weight_mode: 'UNIT_NET_PLUS_TARE',
      reasoning: `netto ${netto}g × ${packSize} + tare ${emptyCase || 0}g = ${computedCaseGross}g/case`,
      already_migrated: false,
    };
  }

  // If only weight exists, classify based on heuristics
  if (weight && weight > 0) {
    if (weight <= 1000 && packSize >= 6) {
      // Looks like per-piece weight
      const computedCaseGross = weight * packSize;
      return {
        id: p.id, code: p.code, name: p.name, weight, netto_weight_per_unit: netto,
        gross_weight_per_unit: gross, empty_case_weight: emptyCase, pack_size: packSize,
        unit_net_g: p.unit_net_g, case_gross_g: p.case_gross_g, weight_mode: p.weight_mode,
        classification: 'unit_weight',
        proposed_unit_net_g: weight,
        proposed_case_gross_g: computedCaseGross,
        proposed_weight_mode: 'UNIT_NET_PLUS_TARE',
        reasoning: `weight ${weight}g looks per-piece (small value + pack_size ${packSize}). Proposed: ${weight}g × ${packSize} = ${computedCaseGross}g/case`,
        already_migrated: false,
      };
    }
    if (weight >= 1500 || packSize <= 2) {
      // Looks like a case weight
      return {
        id: p.id, code: p.code, name: p.name, weight, netto_weight_per_unit: netto,
        gross_weight_per_unit: gross, empty_case_weight: emptyCase, pack_size: packSize,
        unit_net_g: p.unit_net_g, case_gross_g: p.case_gross_g, weight_mode: p.weight_mode,
        classification: 'case_weight',
        proposed_unit_net_g: null,
        proposed_case_gross_g: weight,
        proposed_weight_mode: 'CASE_GROSS',
        reasoning: `weight ${weight}g looks like case weight (large value or small pack_size ${packSize})`,
        already_migrated: false,
      };
    }
    // Ambiguous
    return {
      id: p.id, code: p.code, name: p.name, weight, netto_weight_per_unit: netto,
      gross_weight_per_unit: gross, empty_case_weight: emptyCase, pack_size: packSize,
      unit_net_g: p.unit_net_g, case_gross_g: p.case_gross_g, weight_mode: p.weight_mode,
      classification: 'ambiguous',
      proposed_unit_net_g: null, proposed_case_gross_g: null, proposed_weight_mode: '',
      reasoning: `weight ${weight}g with pack_size ${packSize} — cannot determine if per-piece or per-case`,
      already_migrated: false,
    };
  }

  // gross_weight_per_unit only
  if (gross && gross > 0 && packSize > 0) {
    const computedCaseGross = gross * packSize;
    return {
      id: p.id, code: p.code, name: p.name, weight, netto_weight_per_unit: netto,
      gross_weight_per_unit: gross, empty_case_weight: emptyCase, pack_size: packSize,
      unit_net_g: p.unit_net_g, case_gross_g: p.case_gross_g, weight_mode: p.weight_mode,
      classification: 'unit_weight',
      proposed_unit_net_g: null,
      proposed_case_gross_g: computedCaseGross,
      proposed_weight_mode: 'UNIT_GROSS_PLUS_TARE',
      reasoning: `gross ${gross}g × ${packSize} = ${computedCaseGross}g/case`,
      already_migrated: false,
    };
  }

  return {
    id: p.id, code: p.code, name: p.name, weight, netto_weight_per_unit: netto,
    gross_weight_per_unit: gross, empty_case_weight: emptyCase, pack_size: packSize,
    unit_net_g: p.unit_net_g, case_gross_g: p.case_gross_g, weight_mode: p.weight_mode,
    classification: 'ambiguous',
    proposed_unit_net_g: null, proposed_case_gross_g: null, proposed_weight_mode: '',
    reasoning: 'No weight data available',
    already_migrated: false,
  };
}

interface NormalizeWeightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NormalizeWeightsDialog({ open, onOpenChange }: NormalizeWeightsDialogProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'unit_weight' | 'case_weight' | 'ambiguous'>('all');

  const { data: analyses, isLoading } = useQuery({
    queryKey: ['normalize-weights-analysis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, name, weight, netto_weight_per_unit, gross_weight_per_unit, empty_case_weight, pack_size, unit_net_g, case_gross_g, case_tare_g, weight_mode, case_weight_override_enabled')
        .order('name');
      if (error) throw error;
      return (data || []).map(classifyProduct).filter(a => !a.already_migrated);
    },
    enabled: open,
  });

  const applyMutation = useMutation({
    mutationFn: async (items: ProductAnalysis[]) => {
      let applied = 0;
      for (const item of items) {
        const updateData: Record<string, any> = {};
        if (item.proposed_unit_net_g != null) updateData.unit_net_g = item.proposed_unit_net_g;
        if (item.proposed_case_gross_g != null) updateData.case_gross_g = item.proposed_case_gross_g;
        if (item.proposed_weight_mode) updateData.weight_mode = item.proposed_weight_mode;
        if (item.empty_case_weight != null && item.empty_case_weight > 0) updateData.case_tare_g = item.empty_case_weight;

        if (Object.keys(updateData).length === 0) continue;

        const { error } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', item.id);
        if (error) throw error;
        applied++;
      }
      return applied;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['normalize-weights-analysis'] });
      setSelectedIds(new Set());
      toast({ title: 'Weights normalized', description: `Updated ${count} products with explicit weight fields.` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const filtered = analyses?.filter(a => filter === 'all' || a.classification === filter) || [];
  const autoApplicable = filtered.filter(a => a.classification !== 'ambiguous' && a.proposed_case_gross_g);

  const handleSelectAll = () => {
    if (selectedIds.size === autoApplicable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(autoApplicable.map(a => a.id)));
    }
  };

  const handleApply = () => {
    const toApply = (analyses || []).filter(a => selectedIds.has(a.id));
    applyMutation.mutate(toApply);
  };

  const classIcon = (c: Classification) => {
    if (c === 'unit_weight') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (c === 'case_weight') return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
    return <HelpCircle className="h-4 w-4 text-amber-500" />;
  };

  const classBadge = (c: Classification) => {
    if (c === 'unit_weight') return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Unit → Case</Badge>;
    if (c === 'case_weight') return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Case Direct</Badge>;
    return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Ambiguous</Badge>;
  };

  const counts = {
    all: analyses?.length || 0,
    unit_weight: analyses?.filter(a => a.classification === 'unit_weight').length || 0,
    case_weight: analyses?.filter(a => a.classification === 'case_weight').length || 0,
    ambiguous: analyses?.filter(a => a.classification === 'ambiguous').length || 0,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Normalize Product Weights
          </DialogTitle>
          <DialogDescription>
            Migrate legacy weight fields to the explicit unit/case model. Review classifications before applying.
          </DialogDescription>
        </DialogHeader>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'unit_weight', 'case_weight', 'ambiguous'] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'unit_weight' ? 'Unit → Case' : f === 'case_weight' ? 'Case Direct' : 'Ambiguous'}
              <Badge variant="secondary" className="ml-1">{counts[f]}</Badge>
            </Button>
          ))}
        </div>

        {/* Summary */}
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {counts.ambiguous} product(s) require manual review. {counts.unit_weight + counts.case_weight} can be auto-classified.
        </div>

        {/* Product list */}
        <ScrollArea className="h-[400px] border rounded-md">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Analyzing products...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {counts.all === 0 ? 'All products already migrated! 🎉' : 'No products match this filter.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="p-2 w-8">
                    <Checkbox
                      checked={selectedIds.size > 0 && selectedIds.size === autoApplicable.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-right">Legacy Weight</th>
                  <th className="p-2 text-right">Pack</th>
                  <th className="p-2 text-right">→ Case Gross (g)</th>
                  <th className="p-2 text-left">Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="border-b hover:bg-muted/50">
                    <td className="p-2">
                      {item.classification !== 'ambiguous' && item.proposed_case_gross_g ? (
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedIds);
                            if (checked) next.add(item.id); else next.delete(item.id);
                            setSelectedIds(next);
                          }}
                        />
                      ) : null}
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.code}</div>
                    </td>
                    <td className="p-2">{classBadge(item.classification)}</td>
                    <td className="p-2 text-right font-mono">
                      {item.netto_weight_per_unit ? `${item.netto_weight_per_unit}g (netto)` :
                       item.weight ? `${item.weight}g (raw)` :
                       item.gross_weight_per_unit ? `${item.gross_weight_per_unit}g (gross)` : '—'}
                    </td>
                    <td className="p-2 text-right">{item.pack_size}</td>
                    <td className="p-2 text-right font-mono font-semibold">
                      {item.proposed_case_gross_g ? `${item.proposed_case_gross_g.toLocaleString()}g` : '—'}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground max-w-[200px] truncate" title={item.reasoning}>
                      {item.reasoning}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ScrollArea>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                onClick={handleApply}
                disabled={selectedIds.size === 0 || applyMutation.isPending}
              >
                {applyMutation.isPending ? 'Applying...' : `Apply to ${selectedIds.size} products`}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
