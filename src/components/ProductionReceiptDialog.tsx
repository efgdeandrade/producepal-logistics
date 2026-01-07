import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Printer, FileText } from 'lucide-react';
import ProductionReceipt from './ProductionReceipt';

interface ProductionItem {
  id: string;
  customer_name: string;
  product_code: string;
  product_name: string;
  predicted_quantity: number;
  actual_quantity: number | null;
  notes: string | null;
}

interface ProductionReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryDate: string;
  items: ProductionItem[];
}

const ProductionReceiptDialog = ({ 
  open, 
  onOpenChange, 
  deliveryDate, 
  items 
}: ProductionReceiptDialogProps) => {
  // Group items by customer
  const customerGroups: { [key: string]: ProductionItem[] } = {};
  items.forEach(item => {
    if (!customerGroups[item.customer_name]) {
      customerGroups[item.customer_name] = [];
    }
    customerGroups[item.customer_name].push(item);
  });

  const customerNames = Object.keys(customerGroups).sort();
  
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(
    new Set(customerNames)
  );
  const [isPrinting, setIsPrinting] = useState(false);

  const toggleCustomer = (customerName: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerName)) {
      newSelected.delete(customerName);
    } else {
      newSelected.add(customerName);
    }
    setSelectedCustomers(newSelected);
  };

  const selectAll = () => {
    setSelectedCustomers(new Set(customerNames));
  };

  const deselectAll = () => {
    setSelectedCustomers(new Set());
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  return (
    <>
      <Dialog open={open && !isPrinting} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Print Production Receipts
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Customer Selection */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-lg font-semibold">Select Customers</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Deselect All
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
                {customerNames.map((customerName) => {
                  const itemCount = customerGroups[customerName].length;
                  const totalQty = customerGroups[customerName].reduce(
                    (sum, item) => sum + (item.actual_quantity || 0), 
                    0
                  );
                  
                  return (
                    <div 
                      key={customerName}
                      className="flex items-center justify-between p-3 hover:bg-muted rounded-lg cursor-pointer"
                      onClick={() => toggleCustomer(customerName)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedCustomers.has(customerName)}
                          onCheckedChange={() => toggleCustomer(customerName)}
                        />
                        <div>
                          <p className="font-medium">{customerName}</p>
                          <p className="text-sm text-muted-foreground">
                            {itemCount} products • {totalQty} total items
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Print Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedCustomers.size} of {customerNames.length} customers selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handlePrint} 
                  disabled={selectedCustomers.size === 0}
                  size="lg"
                >
                  <Printer className="mr-2 h-5 w-5" />
                  Print Selected ({selectedCustomers.size})
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Preview (Hidden, only shown when printing) */}
      {isPrinting && (
        <div className="print-only">
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .print-only, .print-only * {
                visibility: visible;
              }
              .print-only {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
            }
            @media screen {
              .print-only {
                display: none;
              }
            }
          `}</style>
          {Array.from(selectedCustomers).map((customerName) => (
            <ProductionReceipt
              key={customerName}
              customerName={customerName}
              deliveryDate={deliveryDate}
              items={customerGroups[customerName]}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default ProductionReceiptDialog;
