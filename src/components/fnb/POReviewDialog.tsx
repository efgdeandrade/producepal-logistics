import { useEffect, useMemo } from 'react';
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
import { AlertCircle, AlertTriangle, Check, Loader2, Calendar } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, parse, isValid } from 'date-fns';

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

  const canConfirm = selectedCustomerId && validItems.length > 0 && !isCreating && selectedDeliveryDate;

  // Check if the date might be ambiguous (both day and month ≤ 12 and different)
  const dateAmbiguityInfo = useMemo(() => {
    if (!selectedDeliveryDate) return { isAmbiguous: false, alternatives: [] };
    
    try {
      const parsed = new Date(selectedDeliveryDate + 'T00:00:00');
      if (!isValid(parsed)) return { isAmbiguous: false, alternatives: [] };
      
      const day = parsed.getDate();
      const month = parsed.getMonth() + 1;
      
      // If both values are ≤ 12 and different, the date could be interpreted either way
      if (day <= 12 && month <= 12 && day !== month) {
        // Create alternative interpretation (swap day and month)
        const altDate = new Date(parsed.getFullYear(), day - 1, month);
        if (isValid(altDate)) {
          return {
            isAmbiguous: true,
            alternatives: [
              { date: selectedDeliveryDate, label: format(parsed, 'EEEE, MMMM d, yyyy') },
              { date: format(altDate, 'yyyy-MM-dd'), label: format(altDate, 'EEEE, MMMM d, yyyy') },
            ],
          };
        }
      }
    } catch {
      // Ignore parsing errors
    }
    
    return { isAmbiguous: false, alternatives: [] };
  }, [selectedDeliveryDate]);

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
          <div className="grid grid-cols-1 gap-4 p-4 bg-muted/50 rounded-lg">
            {/* Customer Selection */}
            <div className="grid grid-cols-3 gap-4">
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
                <Label>Delivery Station</Label>
                <Input
                  type="text"
                  value={selectedDeliveryStation}
                  onChange={(e) => onDeliveryStationChange(e.target.value)}
                  placeholder="e.g., Main Kitchen, Bar"
                />
              </div>
            </div>

            {/* Delivery Date Confirmation - Prominent Section */}
            <div className={`p-4 rounded-lg border-2 ${dateAmbiguityInfo.isAmbiguous ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : 'border-primary/50 bg-primary/5'}`}>
              <div className="flex items-start gap-3">
                <Calendar className={`h-5 w-5 mt-0.5 ${dateAmbiguityInfo.isAmbiguous ? 'text-amber-600' : 'text-primary'}`} />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      Delivery Date - Please Confirm *
                    </Label>
                    {extractedData.delivery_date_raw && (
                      <span className="text-sm text-muted-foreground">
                        From PO: <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">{extractedData.delivery_date_raw}</code>
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Input
                      type="date"
                      value={selectedDeliveryDate}
                      onChange={(e) => onDeliveryDateChange(e.target.value)}
                      className="w-48"
                    />
                    {selectedDeliveryDate && (
                      <span className="text-sm font-medium">
                        {format(new Date(selectedDeliveryDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                      </span>
                    )}
                  </div>

                  {dateAmbiguityInfo.isAmbiguous && (
                    <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-800 dark:text-amber-200">Ambiguous Date Format</AlertTitle>
                      <AlertDescription className="text-amber-700 dark:text-amber-300">
                        <p className="mb-2">This date could be interpreted two ways. Please select the correct one:</p>
                        <div className="flex gap-2">
                          {dateAmbiguityInfo.alternatives.map((alt, idx) => (
                            <Button
                              key={alt.date}
                              variant={selectedDeliveryDate === alt.date ? "default" : "outline"}
                              size="sm"
                              onClick={() => onDeliveryDateChange(alt.date)}
                              className={selectedDeliveryDate === alt.date ? '' : 'border-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30'}
                            >
                              {alt.label}
                            </Button>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
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
