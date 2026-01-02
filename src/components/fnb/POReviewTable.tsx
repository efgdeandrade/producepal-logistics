import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2 } from 'lucide-react';
import { ProductMatchDropdown } from './ProductMatchDropdown';
import { MatchedItem } from '@/hooks/usePOImport';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface POReviewTableProps {
  items: MatchedItem[];
  products: any[];
  onUpdateItem: (index: number, updates: Partial<MatchedItem>) => void;
  onRemoveItem: (index: number) => void;
}

const UNITS = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'kg', label: 'Kg' },
  { value: 'g', label: 'Grams' },
  { value: 'lb', label: 'Lb' },
  { value: 'case', label: 'Case' },
];

export function POReviewTable({
  items,
  products,
  onUpdateItem,
  onRemoveItem,
}: POReviewTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">PO Item</TableHead>
            <TableHead className="min-w-[250px]">Matched Product</TableHead>
            <TableHead className="w-[100px]">Qty</TableHead>
            <TableHead className="w-[100px]">Unit</TableHead>
            <TableHead className="w-[100px]">Price</TableHead>
            <TableHead className="w-[80px]">Save</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={index}>
              <TableCell>
                <div className="text-sm">
                  <div className="font-medium truncate" title={item.description}>
                    {item.description}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    SKU: {item.sku}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <ProductMatchDropdown
                  products={products}
                  value={item.matched_product_id}
                  confidence={item.confidence}
                  onChange={(productId) => {
                    const product = products.find(p => p.id === productId);
                    onUpdateItem(index, {
                      matched_product_id: productId,
                      matched_product_name: product?.name || null,
                      confidence: productId ? 'high' : 'none',
                      unit_price: product?.price_xcg || item.unit_price,
                    });
                  }}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => onUpdateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                  className="w-20"
                />
              </TableCell>
              <TableCell>
                <Select
                  value={item.unit}
                  onValueChange={(value) => onUpdateItem(index, { unit: value })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price || ''}
                  onChange={(e) => onUpdateItem(index, { unit_price: parseFloat(e.target.value) || null })}
                  className="w-20"
                  placeholder="0.00"
                />
              </TableCell>
              <TableCell>
                <Checkbox
                  checked={item.save_mapping}
                  onCheckedChange={(checked) => onUpdateItem(index, { save_mapping: !!checked })}
                  disabled={!item.matched_product_id || item.confidence === 'high'}
                  title={item.confidence === 'high' ? 'Already verified' : 'Save this mapping for future imports'}
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveItem(index)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
