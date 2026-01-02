import { useState } from "react";
import { useDriverWallet } from "@/hooks/useDriverWallet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  ChevronRight,
  History 
} from "lucide-react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DriverMobileWallet() {
  const { wallet, transactions, isLoading } = useDriverWallet();
  const [showHistory, setShowHistory] = useState(false);

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-4">
          <div className="animate-pulse flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-primary/20 rounded w-24 mb-1" />
              <div className="h-6 bg-primary/20 rounded w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Today's collections from transactions
  const today = new Date().toISOString().split("T")[0];
  const todayCollections = transactions
    .filter(tx => tx.transaction_type === "collection" && tx.created_at.startsWith(today))
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <>
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">COD Balance to Deposit</p>
                <p className="text-2xl font-bold">{(wallet?.current_balance || 0).toFixed(2)} XCG</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(true)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {todayCollections > 0 && (
            <div className="mt-3 pt-3 border-t border-primary/20 flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Today's collections:</span>
              <span className="font-medium text-green-600">+{todayCollections.toFixed(2)} XCG</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction History Sheet */}
      <Sheet open={showHistory} onOpenChange={setShowHistory}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              My Wallet History
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-3xl font-bold">{(wallet?.current_balance || 0).toFixed(2)} XCG</p>
            <p className="text-xs text-muted-foreground mt-1">
              Deposit this to clear your balance
            </p>
          </div>

          <ScrollArea className="h-[calc(100vh-250px)] mt-4">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions yet
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      {tx.transaction_type === "collection" ? (
                        <ArrowUpCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4 text-blue-600" />
                      )}
                      <div>
                        <Badge variant="outline" className="capitalize text-xs">
                          {tx.transaction_type}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(tx.created_at), "MMM d, HH:mm")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${tx.transaction_type === "collection" ? "text-green-600" : "text-blue-600"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bal: {tx.balance_after.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
