import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Package } from 'lucide-react';

interface ShortageRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    productName: string;
    productCode: string;
    orderedQuantity: number;
    unit: string;
  } | null;
  onSubmit: (data: {
    itemId: string;
    availableQuantity: number;
    reason: string;
    notes?: string;
  }) => void;
  isLoading?: boolean;
}

const SHORT_REASONS = [
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'damaged', label: 'Product Damaged' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'expired', label: 'Expired/Near Expiry' },
  { value: 'wrong_location', label: 'Cannot Locate' },
  { value: 'other', label: 'Other' },
];

export function ShortageRequestDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
  isLoading,
}: ShortageRequestDialogProps) {
  const [availableQty, setAvailableQty] = useState('0');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!item || !reason) return;
    
    onSubmit({
      itemId: item.id,
      availableQuantity: parseInt(availableQty) || 0,
      reason,
      notes: notes.trim() || undefined,
    });

    // Reset form
    setAvailableQty('0');
    setReason('');
    setNotes('');
  };

  const handleClose = () => {
    onOpenChange(false);
    setAvailableQty('0');
    setReason('');
    setNotes('');
  };

  if (!item) return null;

  const shortQty = item.orderedQuantity - (parseInt(availableQty) || 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Report Shortage
          </DialogTitle>
          <DialogDescription>
            This will require supervisor approval before the order can be completed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Info */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{item.productName}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Code: {item.productCode} • Ordered: {item.orderedQuantity} {item.unit}
            </div>
          </div>

          {/* Available Quantity */}
          <div className="space-y-2">
            <Label htmlFor="available-qty">Available Quantity</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => setAvailableQty(Math.max(0, (parseInt(availableQty) || 0) - 1).toString())}
              >
                -
              </Button>
              <Input
                id="available-qty"
                type="number"
                min="0"
                max={item.orderedQuantity}
                value={availableQty}
                onChange={(e) => setAvailableQty(e.target.value)}
                className="h-12 text-center text-lg font-bold w-24"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => setAvailableQty(Math.min(item.orderedQuantity, (parseInt(availableQty) || 0) + 1).toString())}
              >
                +
              </Button>
              <span className="text-muted-foreground">
                / {item.orderedQuantity} {item.unit}
              </span>
            </div>
            {shortQty > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Short: {shortQty} {item.unit}
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="shortage-reason">Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {SHORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="shortage-notes">Additional Notes (optional)</Label>
            <Textarea
              id="shortage-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              className="h-20 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason || isLoading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? 'Submitting...' : 'Request Approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
