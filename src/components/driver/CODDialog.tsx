import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  X, 
  Camera, 
  Upload, 
  Banknote, 
  CreditCard, 
  ArrowRightLeft,
  Store,
  CheckCircle
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';

type PaymentMethodType = "cash" | "swipe" | "transfer" | "credit";

interface DeliveryOrder {
  id: string;
  order_number: string;
  total_xcg: number | null;
  distribution_customers: {
    name: string;
    customer_type: string;
  } | null;
}

interface CODDialogProps {
  order: DeliveryOrder | null;
  onClose: () => void;
  onConfirm: (codCollected: number, paymentMethod: PaymentMethodType, receiptPath?: string) => void;
  isLoading: boolean;
}

export default function CODDialog({
  order,
  onClose,
  onConfirm,
  isLoading,
}: CODDialogProps) {
  const [codAmount, setCodAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash');
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSupermarket = order?.distribution_customers?.customer_type === 'supermarket';
  const isCredit = order?.distribution_customers?.customer_type === 'credit';

  // Reset state when order changes
  useState(() => {
    if (order) {
      setCodAmount(order.total_xcg?.toFixed(2) || '0');
      if (isCredit) {
        setPaymentMethod('credit');
      } else {
        setPaymentMethod('cash');
      }
      setReceiptPhoto(null);
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptPhoto(file);
    }
  };

  const handleTakePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleConfirm = async () => {
    if (!order) return;

    // Supermarket requires receipt
    if (isSupermarket && !receiptPhoto) {
      toast.error('Receipt photo required for supermarket orders');
      return;
    }

    setUploading(true);
    let receiptPath: string | undefined;

    try {
      if (receiptPhoto) {
        const fileExt = receiptPhoto.name.split('.').pop();
        const fileName = `${order.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("delivery-receipts")
          .upload(fileName, receiptPhoto);
        
        if (uploadError) throw uploadError;
        receiptPath = fileName;
      }

      const amount = parseFloat(codAmount) || 0;
      onConfirm(amount, paymentMethod, receiptPath);
    } catch (error: any) {
      toast.error('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-lg bg-card rounded-t-2xl shadow-xl animate-in slide-in-from-bottom duration-300 safe-area-bottom">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Complete Delivery</h2>
            <p className="text-sm text-muted-foreground">{order.distribution_customers?.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Order total */}
          <div className="flex items-center justify-between py-3 px-4 bg-muted rounded-lg">
            <span className="text-muted-foreground">Order Total</span>
            <span className="text-xl font-bold">{order.total_xcg?.toFixed(2)} XCG</span>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethodType)}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-green-600" />
                    Cash
                  </div>
                </SelectItem>
                <SelectItem value="swipe">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    Card (Swipe)
                  </div>
                </SelectItem>
                <SelectItem value="transfer">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-purple-600" />
                    Bank Transfer
                  </div>
                </SelectItem>
                <SelectItem value="credit">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-orange-600" />
                    On Credit
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount collected */}
          {paymentMethod !== 'credit' && (
            <div className="space-y-2">
              <Label>Amount Collected (XCG)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={codAmount}
                onChange={(e) => setCodAmount(e.target.value)}
                className="h-14 text-xl font-bold text-center"
                placeholder="0.00"
              />
            </div>
          )}

          {/* Receipt photo - Required for supermarket */}
          {isSupermarket && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Receipt Photo 
                <span className="text-destructive">*</span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {receiptPhoto ? (
                <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/30">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <span className="flex-1 text-sm truncate">{receiptPhoto.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReceiptPhoto(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-14 border-dashed"
                  onClick={handleTakePhoto}
                >
                  <Camera className="h-5 w-5 mr-2" />
                  Take Receipt Photo
                </Button>
              )}
            </div>
          )}

          {/* Optional receipt for non-supermarket */}
          {!isSupermarket && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Receipt Photo (Optional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {receiptPhoto ? (
                <div className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="flex-1 text-sm truncate">{receiptPhoto.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReceiptPhoto(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={handleTakePhoto}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Add Photo
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <Button
            className="w-full h-14 text-lg font-semibold"
            onClick={handleConfirm}
            disabled={isLoading || uploading || (isSupermarket && !receiptPhoto)}
          >
            {isLoading || uploading ? (
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {uploading ? 'Uploading...' : 'Saving...'}
              </span>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Confirm Delivery
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
