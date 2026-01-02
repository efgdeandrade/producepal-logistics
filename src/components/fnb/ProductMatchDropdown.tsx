import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';

interface ProductMatchDropdownProps {
  products: any[];
  value: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  onChange: (productId: string | null) => void;
}

export function ProductMatchDropdown({
  products,
  value,
  confidence,
  onChange,
}: ProductMatchDropdownProps) {
  const options = products.map(p => ({
    value: p.id,
    label: `${p.code} - ${p.name}`,
  }));

  const getConfidenceBadge = () => {
    switch (confidence) {
      case 'high':
        return <Badge variant="default" className="bg-green-500 text-white text-xs">Verified</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-yellow-500 text-white text-xs">Suggested</Badge>;
      case 'low':
        return <Badge variant="secondary" className="bg-orange-500 text-white text-xs">Low match</Badge>;
      case 'none':
        return <Badge variant="destructive" className="text-xs">No match</Badge>;
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
