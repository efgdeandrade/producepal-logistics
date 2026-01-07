import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { ArrowDownCircle, Wallet, CheckCircle } from "lucide-react";

interface RecordDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: {
    id: string;
    driver_id: string;
    current_balance: number;
    profiles?: { full_name: string | null; email: string } | null;
  } | null;
  onConfirm: (data: {
    walletId: string;
    driverId: string;
    amount: number;
    depositReference?: string;
    notes?: string;
  }) => void;
  isLoading: boolean;
}

export default function RecordDepositDialog({
  open,
  onOpenChange,
  wallet,
  onConfirm,
  isLoading,
}: RecordDepositDialogProps) {
  const [amount, setAmount] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    if (!wallet) return;
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) return;

    onConfirm({
      walletId: wallet.id,
      driverId: wallet.driver_id,
      amount: depositAmount,
      depositReference: depositReference || undefined,
      notes: notes || undefined,
    });

    // Reset form
    setAmount("");
    setDepositReference("");
    setNotes("");
  };

  const driverName = wallet?.profiles?.full_name || wallet?.profiles?.email || "Driver";
  const maxAmount = wallet?.current_balance || 0;
  const parsedAmount = parseFloat(amount) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5" />
            Record Cash Deposit
          </DialogTitle>
        </DialogHeader>

        {wallet && (
          <div className="space-y-4">
            {/* Driver info */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{driverName}</span>
              </div>
              <p className="text-sm text-muted-foreground">Outstanding Balance</p>
              <p className="text-2xl font-bold">{maxAmount.toFixed(2)} XCG</p>
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <Label>Deposit Amount (XCG)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-lg font-medium"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(maxAmount.toFixed(2))}
                >
                  Full Amount
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount((maxAmount / 2).toFixed(2))}
                >
                  50%
                </Button>
              </div>
              {parsedAmount > maxAmount && (
                <p className="text-sm text-destructive">
                  Amount exceeds outstanding balance
                </p>
              )}
            </div>

            {/* Reference number */}
            <div className="space-y-2">
              <Label>Reference Number (Optional)</Label>
              <Input
                value={depositReference}
                onChange={(e) => setDepositReference(e.target.value)}
                placeholder="e.g., ENV-042, REC-123"
              />
              <p className="text-xs text-muted-foreground">
                Envelope number, receipt number, or bank reference
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>

            {/* Summary */}
            {parsedAmount > 0 && parsedAmount <= maxAmount && (
              <div className="p-3 bg-success/10 border border-success/30 rounded-lg">
                <p className="text-sm text-muted-foreground">After deposit</p>
                <p className="text-lg font-bold text-success">
                  {(maxAmount - parsedAmount).toFixed(2)} XCG remaining
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || parsedAmount <= 0 || parsedAmount > maxAmount}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Record Deposit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
