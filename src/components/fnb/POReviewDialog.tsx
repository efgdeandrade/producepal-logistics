import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { POReviewTable } from './POReviewTable';
import { MatchedItem, ExtractedPOData } from '@/hooks/usePOImport';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface POReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractedData: ExtractedPOData;
  matchedItems: MatchedItem[];
  customers: any[];
  products: any[];
  selectedCustomerId: string;
  selectedDeliveryDate: string;
  selectedDeliveryStation: string;
  onCustomerChange: (customerId: string) => void;
  onDeliveryDateChange: (date: string) => void;
  onDeliveryStationChange: (station: string) => void;
  onUpdateItem: (index: number, updates: Partial<MatchedItem>) => void;
  onRemoveItem: (index: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isCreating?: boolean;
}

export function POReviewDialog({
  open,
  onOpenChange,
  extractedData,
  matchedItems,
  customers,
  products,
  selectedCustomerId,
  selectedDeliveryDate,
  selectedDeliveryStation,
  onCustomerChange,
  onDeliveryDateChange,
  onDeliveryStationChange,
  onUpdateItem,
  onRemoveItem,
  onConfirm,
  onCancel,
  isCreating,
}: POReviewDialogProps) {
  // Try to auto-match customer by name/code
  useEffect(() => {
    if (!selectedCustomerId && extractedData?.customer_name) {
      const normalizedName = extractedData.customer_name.toLowerCase();
      const normalizedCode = extractedData.customer_code?.toLowerCase();
      
      const match = customers?.find(c => {
        const custName = c.name.toLowerCase();
        const custNotes = c.notes?.toLowerCase() || '';
        return (
          custName.includes(normalizedName) ||
          normalizedName.includes(custName) ||
          (normalizedCode && custNotes.includes(normalizedCode))
        );
      });
      
      if (match) {
        onCustomerChange(match.id);
      }
    }
  }, [extractedData, customers, selectedCustomerId, onCustomerChange]);

  const customerOptions = customers?.map(c => ({
    value: c.id,
    label: c.name,
  })) || [];

  const unmatchedCount = matchedItems.filter(i => !i.matched_product_id).length;
  const validItems = matchedItems.filter(i => i.matched_product_id);

  const canConfirm = selectedCustomerId && validItems.length > 0 && !isCreating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Purchase Order Import</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* PO Info */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">PO Number</Label>
              <div className="font-medium">{extractedData.po_number}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">PO Customer</Label>
              <div className="font-medium text-sm">
                {extractedData.customer_name}
                {extractedData.customer_code && (
                  <span className="text-muted-foreground ml-1">({extractedData.customer_code})</span>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <div className="font-medium">{extractedData.currency || 'Not specified'}</div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <SearchableSelect
                options={customerOptions}
                value={selectedCustomerId}
                onValueChange={onCustomerChange}
                placeholder="Select customer..."
                emptyMessage="No customers found"
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Input
                type="date"
                value={selectedDeliveryDate}
                onChange={(e) => onDeliveryDateChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery Station</Label>
              <Input
                type="text"
                value={selectedDeliveryStation}
                onChange={(e) => onDeliveryStationChange(e.target.value)}
                placeholder="e.g., Main Kitchen, Bar"
              />
            </div>
          </div>

          {/* Warnings */}
          {unmatchedCount > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {unmatchedCount} item{unmatchedCount > 1 ? 's' : ''} could not be matched to products. 
                Please select products manually or remove the items.
              </AlertDescription>
            </Alert>
          )}

          {/* Items Table */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Line Items ({matchedItems.length})
            </Label>
            <POReviewTable
              items={matchedItems}
              products={products}
              onUpdateItem={onUpdateItem}
              onRemoveItem={onRemoveItem}
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-green-500" />
            {validItems.length} items ready to import
          </div>
          <Button variant="outline" onClick={onCancel} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!canConfirm}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Order'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
