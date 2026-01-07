import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Wallet, ArrowDownCircle, TrendingUp, AlertTriangle } from "lucide-react";

interface DriverWalletCardProps {
  wallet: {
    id: string;
    driver_id: string;
    current_balance: number;
    total_collected: number;
    total_deposited: number;
    profiles?: { full_name: string | null; email: string } | null;
  };
  onRecordDeposit: () => void;
  onViewHistory: () => void;
}

export default function DriverWalletCard({ wallet, onRecordDeposit, onViewHistory }: DriverWalletCardProps) {
  const isHighBalance = wallet.current_balance > 500;
  const driverName = wallet.profiles?.full_name || wallet.profiles?.email || "Unknown Driver";

  return (
    <Card className={`relative ${isHighBalance ? 'border-orange-500/50 bg-orange-500/5' : ''}`}>
      {isHighBalance && (
        <Badge className="absolute -top-2 -right-2 bg-orange-500 text-white">
          <AlertTriangle className="h-3 w-3 mr-1" />
          High Balance
        </Badge>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          {driverName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Outstanding Balance</p>
          <p className={`text-3xl font-bold ${isHighBalance ? 'text-orange-600' : ''}`}>
            {wallet.current_balance.toFixed(2)} XCG
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-green-600" />
            <span>Collected: {wallet.total_collected.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <ArrowDownCircle className="h-3 w-3 text-blue-600" />
            <span>Deposited: {wallet.total_deposited.toFixed(0)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={onViewHistory}
          >
            History
          </Button>
          <Button 
            size="sm" 
            className="flex-1"
            onClick={onRecordDeposit}
            disabled={wallet.current_balance <= 0}
          >
            <ArrowDownCircle className="h-4 w-4 mr-1" />
            Deposit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
