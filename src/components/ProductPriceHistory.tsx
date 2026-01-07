import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface PriceHistoryEntry {
  id: string;
  product_code: string;
  product_name: string;
  old_price_usd_per_unit: number | null;
  new_price_usd_per_unit: number | null;
  old_price_xcg_per_unit: number | null;
  new_price_xcg_per_unit: number | null;
  changed_by_email: string;
  created_at: string;
}

interface ProductPriceHistoryProps {
  productId: string;
  productCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductPriceHistory({ productId, productCode, open, onOpenChange }: ProductPriceHistoryProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['product-price-history', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_price_history')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PriceHistoryEntry[];
    },
    enabled: open,
  });

  const getPriceChangeIcon = (oldPrice: number | null, newPrice: number | null) => {
    if (oldPrice === null || newPrice === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (newPrice > oldPrice) return <ArrowUp className="h-4 w-4 text-green-600" />;
    if (newPrice < oldPrice) return <ArrowDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getPriceChangeBadge = (oldPrice: number | null, newPrice: number | null) => {
    if (oldPrice === null || newPrice === null) return null;
    const diff = newPrice - oldPrice;
    const percentage = ((diff / oldPrice) * 100).toFixed(1);
    
    if (diff > 0) {
      return <Badge variant="outline" className="text-green-600 border-green-600">+{percentage}%</Badge>;
    } else if (diff < 0) {
      return <Badge variant="outline" className="text-red-600 border-red-600">{percentage}%</Badge>;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Price History - {productCode}</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !history || history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No price history available for this product.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Changed By</TableHead>
                  <TableHead className="text-right">Old USD/Unit</TableHead>
                  <TableHead className="text-right">New USD/Unit</TableHead>
                  <TableHead className="text-center">Change</TableHead>
                  <TableHead className="text-right">Old Cg/Unit</TableHead>
                  <TableHead className="text-right">New Cg/Unit</TableHead>
                  <TableHead className="text-center">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.changed_by_email}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.old_price_usd_per_unit !== null 
                        ? `$${entry.old_price_usd_per_unit.toFixed(2)}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {entry.new_price_usd_per_unit !== null 
                        ? `$${entry.new_price_usd_per_unit.toFixed(2)}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {getPriceChangeIcon(entry.old_price_usd_per_unit, entry.new_price_usd_per_unit)}
                        {getPriceChangeBadge(entry.old_price_usd_per_unit, entry.new_price_usd_per_unit)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.old_price_xcg_per_unit !== null 
                        ? `Cg ${entry.old_price_xcg_per_unit.toFixed(2)}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {entry.new_price_xcg_per_unit !== null 
                        ? `Cg ${entry.new_price_xcg_per_unit.toFixed(2)}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {getPriceChangeIcon(entry.old_price_xcg_per_unit, entry.new_price_xcg_per_unit)}
                        {getPriceChangeBadge(entry.old_price_xcg_per_unit, entry.new_price_xcg_per_unit)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
