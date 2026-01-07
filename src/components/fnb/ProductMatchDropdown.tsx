import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Sparkles, AlertTriangle, HelpCircle } from 'lucide-react';

interface ProductMatchDropdownProps {
  products: any[];
  value: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  wasManuallyChanged?: boolean;
  onChange: (productId: string | null) => void;
}

export function ProductMatchDropdown({
  products,
  value,
  confidence,
  wasManuallyChanged,
  onChange,
}: ProductMatchDropdownProps) {
  const options = products.map(p => ({
    value: p.id,
    label: `${p.code} - ${p.name}`,
  }));

  const getConfidenceBadge = () => {
    // If user manually changed, show "Will Learn" badge
    if (wasManuallyChanged && value) {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs gap-1">
          <Sparkles className="h-3 w-3" />
          Learn
        </Badge>
      );
    }
    
    switch (confidence) {
      case 'high':
        return (
          <Badge variant="default" className="bg-green-500 text-white text-xs gap-1">
            <CheckCircle className="h-3 w-3" />
            Verified
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 text-xs gap-1">
            <Sparkles className="h-3 w-3" />
            AI Match
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs gap-1">
            <AlertTriangle className="h-3 w-3" />
            Low
          </Badge>
        );
      case 'none':
        return (
          <Badge variant="destructive" className="text-xs gap-1">
            <HelpCircle className="h-3 w-3" />
            Select
          </Badge>
        );
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <SearchableSelect
          options={options}
          value={value || ''}
          onValueChange={(val) => onChange(val || null)}
          placeholder="Select product..."
          emptyMessage="No products found"
        />
      </div>
      {getConfidenceBadge()}
    </div>
  );
}