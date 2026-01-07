import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpCircle, ArrowDownCircle, Settings, Wallet } from "lucide-react";
import { useWalletTransactions } from "@/hooks/useDriverWallet";

interface WalletTransactionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string | null;
  driverName: string;
}

export default function WalletTransactionHistory({
  open,
  onOpenChange,
  driverId,
  driverName,
}: WalletTransactionHistoryProps) {
  const { data: transactions = [], isLoading } = useWalletTransactions(driverId);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "collection":
        return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
      case "deposit":
        return <ArrowDownCircle className="h-4 w-4 text-blue-600" />;
      case "adjustment":
        return <Settings className="h-4 w-4 text-orange-600" />;
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "collection":
        return "text-green-600";
      case "deposit":
        return "text-blue-600";
      case "adjustment":
        return "text-orange-600";
      default:
        return "";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet History: {driverName}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions yet
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx: any) => (
                <div
                  key={tx.id}
                  className="flex items-start gap-3 p-3 border rounded-lg"
                >
                  <div className="mt-0.5">{getTransactionIcon(tx.transaction_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="capitalize text-xs">
                        {tx.transaction_type}
                      </Badge>
                      <span className={`font-bold ${getTransactionColor(tx.transaction_type)}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)} XCG
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {tx.fnb_orders?.order_number && (
                        <p>Order: {tx.fnb_orders.order_number}</p>
                      )}
                      {tx.fnb_orders?.fnb_customers?.name && (
                        <p>{tx.fnb_orders.fnb_customers.name}</p>
                      )}
                      {tx.deposit_reference && (
                        <p>Ref: {tx.deposit_reference}</p>
                      )}
                      {tx.notes && <p className="italic">{tx.notes}</p>}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {format(new Date(tx.created_at), "MMM d, HH:mm")}
                      </span>
                      <span>
                        Balance: {tx.balance_after.toFixed(2)} XCG
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
