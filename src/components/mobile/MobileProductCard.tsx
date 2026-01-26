import { X, Check, Sparkles, Zap, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResponsiveSearchableSelect } from '@/components/ui/responsive-searchable-select';
import { MobileQuantityInput } from './MobileQuantityInput';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  code: string;
  name: string;
  name_pap?: string | null;
  name_nl?: string | null;
  name_es?: string | null;
  price_xcg: number;
  unit: string;
}

interface MobileProductCardProps {
  rawText: string;
  quantity: number;
  unit: string;
  matchedProductId: string | null;
  matchSource: string;
  suggestedPrice: number | null;
  products: Product[];
  onQuantityChange: (quantity: number) => void;
  onProductChange: (productId: string, productName: string | null, price: number | null) => void;
  onRemove: () => void;
  className?: string;
}

export function MobileProductCard({
  rawText,
  quantity,
  unit,
  matchedProductId,
  matchSource,
  suggestedPrice,
  products,
  onQuantityChange,
  onProductChange,
  onRemove,
  className
}: MobileProductCardProps) {
  const getConfidenceBadge = () => {
    switch (matchSource) {
      case 'verified':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-200">
            <Check className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case 'customer_mapping':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
            <Sparkles className="h-3 w-3 mr-1" />
            Learned
          </Badge>
        );
      case 'ai_match':
      case 'product_name':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">
            <Zap className="h-3 w-3 mr-1" />
            AI Match
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Review
          </Badge>
        );
    }
  };

  const selectedProduct = products.find(p => p.id === matchedProductId);
  const totalPrice = quantity * (suggestedPrice || 0);

  return (
    <Card className={cn(
      "relative overflow-hidden transition-colors w-full",
      "max-w-full",
      !matchedProductId && "border-amber-300 bg-amber-50/30 dark:bg-amber-950/20",
      className
    )}>
      <CardContent className="p-4 space-y-4">
        {/* Header: Raw text + Remove button, Badge below */}
        <div className="space-y-2">
          {/* First row: Raw text + Delete button */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-muted-foreground italic line-clamp-2 flex-1 min-w-0 break-words">
              "{rawText}"
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              onClick={onRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Second row: Confidence badge */}
          <div className="flex">
            {getConfidenceBadge()}
          </div>
        </div>

        {/* Quantity - Full width stepper */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Quantity
          </label>
          <MobileQuantityInput
            value={quantity}
            onChange={onQuantityChange}
            unit={unit}
            step={unit === 'kg' || unit === 'lb' ? 0.5 : 1}
            min={0}
          />
        </div>

        {/* Product Selector - Full width */}
        <div className="space-y-2 min-w-0">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Product
          </label>
          <ResponsiveSearchableSelect
            options={products.map(p => ({
              value: p.id,
              label: `${p.name} (${p.code})`,
              searchTerms: `${p.name} ${p.code} ${p.name_pap || ''} ${p.name_nl || ''} ${p.name_es || ''}`
            }))}
            value={matchedProductId || ''}
            onValueChange={(value) => {
              const product = products.find(p => p.id === value);
              onProductChange(
                value,
                product?.name || null,
                product?.price_xcg || null
              );
            }}
            placeholder="Select product..."
            emptyMessage="No products found"
          />
        </div>

        {/* Price footer */}
        {selectedProduct && suggestedPrice !== null && (
          <div className="flex items-center justify-between pt-2 border-t text-sm">
            <span className="text-muted-foreground">
              ƒ{suggestedPrice.toFixed(2)}/{unit}
            </span>
            <span className="font-semibold">
              ƒ{totalPrice.toFixed(2)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
