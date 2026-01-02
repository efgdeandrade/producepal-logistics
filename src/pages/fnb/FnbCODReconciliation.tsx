import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Banknote, CheckCircle, Clock, User, Calendar, Wallet, ArrowDownCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import DriverWalletCard from "@/components/fnb/DriverWalletCard";
import RecordDepositDialog from "@/components/fnb/RecordDepositDialog";
import WalletTransactionHistory from "@/components/fnb/WalletTransactionHistory";
import { useAllDriverWallets, useRecordDeposit } from "@/hooks/useDriverWallet";

export default function FnbCODReconciliation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [reconcileNotes, setReconcileNotes] = useState("");
  
  // Wallet state
  const [depositDialogWallet, setDepositDialogWallet] = useState<any>(null);
  const [historyDriverId, setHistoryDriverId] = useState<string | null>(null);
  const [historyDriverName, setHistoryDriverName] = useState<string>("");

  // Wallet hooks
  const { wallets, isLoading: walletsLoading, refetch: refetchWallets } = useAllDriverWallets();
  const depositMutation = useRecordDeposit();

  // Get date range based on filter
  const getDateRange = () => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    
    if (dateFilter === "today") {
      return { start: today, end: today };
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday.toISOString().split("T")[0], end: yesterday.toISOString().split("T")[0] };
    } else if (dateFilter === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: weekAgo.toISOString().split("T")[0], end: today };
    }
    return { start: today, end: today };
  };

  // Fetch COD orders pending reconciliation
  const { data: codOrders, isLoading } = useQuery({
    queryKey: ["fnb-cod-orders", dateFilter, driverFilter],
    queryFn: async () => {
      const { start, end } = getDateRange();
      let query = supabase
        .from("fnb_orders")
        .select(`
          *,
          fnb_customers (name)
        `)
        .eq("status", "delivered")
        .eq("payment_method", "cod")
        .not("cod_amount_collected", "is", null)
        .is("cod_reconciled_at", null)
        .gte("delivered_at", `${start}T00:00:00`)
        .lte("delivered_at", `${end}T23:59:59`)
        .order("delivered_at", { ascending: false });

      if (driverFilter !== "all") {
        query = query.eq("driver_id", driverFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch reconciled orders for history
  const { data: reconciledOrders } = useQuery({
    queryKey: ["fnb-cod-reconciled", dateFilter],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("fnb_orders")
        .select(`
          *,
          fnb_customers (name)
        `)
        .eq("status", "delivered")
        .eq("payment_method", "cod")
        .not("cod_reconciled_at", "is", null)
        .gte("cod_reconciled_at", `${start}T00:00:00`)
        .lte("cod_reconciled_at", `${end}T23:59:59`)
        .order("cod_reconciled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch drivers for filter
  const { data: drivers } = useQuery({
    queryKey: ["fnb-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles!inner(id, full_name, email)")
        .eq("role", "driver");
      if (error) throw error;
      return data;
    },
  });

  // Reconcile mutation
  const reconcileMutation = useMutation({
    mutationFn: async ({ orderIds, notes }: { orderIds: string[]; notes: string }) => {
      const { error } = await supabase
        .from("fnb_orders")
        .update({
          cod_reconciled_at: new Date().toISOString(),
          cod_reconciled_by: user?.id,
          cod_notes: notes || null,
        })
        .in("id", orderIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedOrders.length} order(s) reconciled`);
      queryClient.invalidateQueries({ queryKey: ["fnb-cod-orders"] });
      queryClient.invalidateQueries({ queryKey: ["fnb-cod-reconciled"] });
      setSelectedOrders([]);
      setReconcileDialogOpen(false);
      setReconcileNotes("");
    },
    onError: (error) => {
      toast.error("Failed to reconcile: " + error.message);
    },
  });

  // Handle deposit confirmation
  const handleDepositConfirm = async (data: {
    walletId: string;
    driverId: string;
    amount: number;
    depositReference?: string;
    notes?: string;
  }) => {
    await depositMutation.mutateAsync(data);
    toast.success(`Deposit of ${data.amount.toFixed(2)} XCG recorded`);
    setDepositDialogWallet(null);
    refetchWallets();
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(codOrders?.map((o) => o.id) || []);
    } else {
      setSelectedOrders([]);
    }
  };

  const handleReconcile = () => {
    reconcileMutation.mutate({
      orderIds: selectedOrders,
      notes: reconcileNotes,
    });
  };

  // Calculate totals
  const pendingTotal = codOrders?.reduce((sum, o) => sum + (o.cod_amount_collected || 0), 0) || 0;
  const reconciledTotal = reconciledOrders?.reduce((sum, o) => sum + (o.cod_amount_collected || 0), 0) || 0;
  const selectedTotal = codOrders
    ?.filter((o) => selectedOrders.includes(o.id))
    .reduce((sum, o) => sum + (o.cod_amount_collected || 0), 0) || 0;

  // Group by driver for summary
  const driverSummary = codOrders?.reduce((acc: Record<string, { name: string; total: number; count: number }>, order) => {
    const driverId = order.driver_id || "unknown";
    const driverName = order.driver_name || "Unknown Driver";
    if (!acc[driverId]) {
      acc[driverId] = { name: driverName, total: 0, count: 0 };
    }
    acc[driverId].total += order.cod_amount_collected || 0;
    acc[driverId].count += 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fnb">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">COD Reconciliation</h1>
            <p className="text-muted-foreground">Track and reconcile cash on delivery payments</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Reconciliation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingTotal.toFixed(2)} XCG</div>
              <p className="text-xs text-muted-foreground">{codOrders?.length || 0} orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Reconciled ({dateFilter})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{reconciledTotal.toFixed(2)} XCG</div>
              <p className="text-xs text-muted-foreground">{reconciledOrders?.length || 0} orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Selected for Reconciliation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedTotal.toFixed(2)} XCG</div>
              <p className="text-xs text-muted-foreground">{selectedOrders.length} orders selected</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="wallets" className="space-y-4">
          <TabsList>
            <TabsTrigger value="wallets" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Driver Wallets
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Order Reconciliation
            </TabsTrigger>
          </TabsList>

          {/* Driver Wallets Tab */}
          <TabsContent value="wallets" className="space-y-4">
            {walletsLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading wallets...</p>
            ) : wallets.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No driver wallets yet</p>
                  <p className="text-sm">Wallets are created when drivers collect COD payments</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Total outstanding */}
                <Card className="bg-orange-500/5 border-orange-500/20">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-orange-600" />
                        <span className="font-medium">Total Outstanding COD</span>
                      </div>
                      <span className="text-2xl font-bold text-orange-600">
                        {wallets.reduce((sum, w) => sum + (w.current_balance || 0), 0).toFixed(2)} XCG
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Wallet cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {wallets.map((wallet: any) => (
                    <DriverWalletCard
                      key={wallet.id}
                      wallet={wallet}
                      onRecordDeposit={() => setDepositDialogWallet(wallet)}
                      onViewHistory={() => {
                        setHistoryDriverId(wallet.driver_id);
                        setHistoryDriverName(wallet.profiles?.full_name || wallet.profiles?.email || "Driver");
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* Order Reconciliation Tab */}
          <TabsContent value="orders" className="space-y-4">
            {/* Driver Summary */}
            {driverSummary && Object.keys(driverSummary).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pending by Driver</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                    {Object.entries(driverSummary).map(([driverId, summary]) => (
                      <div key={driverId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{summary.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{summary.total.toFixed(2)} XCG</p>
                          <p className="text-xs text-muted-foreground">{summary.count} orders</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Filters and Actions */}
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  <div className="flex gap-4">
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Date range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="week">Last 7 days</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={driverFilter} onValueChange={setDriverFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by driver" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Drivers</SelectItem>
                        {drivers?.map((driver) => (
                          <SelectItem key={driver.user_id} value={driver.user_id}>
                            {driver.profiles?.full_name || driver.profiles?.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => setReconcileDialogOpen(true)}
                    disabled={selectedOrders.length === 0}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Reconcile {selectedOrders.length} Order(s)
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading...</p>
                ) : codOrders?.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No pending COD orders to reconcile</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedOrders.length === codOrders?.length && codOrders.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Delivered</TableHead>
                        <TableHead>Order Total</TableHead>
                        <TableHead>Collected</TableHead>
                        <TableHead>Difference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {codOrders?.map((order) => {
                        const diff = (order.cod_amount_collected || 0) - (order.total_xcg || 0);
                        return (
                          <TableRow key={order.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedOrders.includes(order.id)}
                                onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell className="font-mono">{order.order_number}</TableCell>
                            <TableCell>{order.fnb_customers?.name}</TableCell>
                            <TableCell>{order.driver_name || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {order.payment_method_used || order.payment_method || "cash"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {order.delivered_at && format(new Date(order.delivered_at), "MMM d, HH:mm")}
                            </TableCell>
                            <TableCell>{order.total_xcg?.toFixed(2)} XCG</TableCell>
                            <TableCell className="font-medium">{order.cod_amount_collected?.toFixed(2)} XCG</TableCell>
                            <TableCell>
                              {diff !== 0 ? (
                                <Badge variant={diff > 0 ? "default" : "destructive"}>
                                  {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Match</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Reconcile Dialog */}
        <Dialog open={reconcileDialogOpen} onOpenChange={setReconcileDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reconcile COD Payments</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Orders to reconcile</p>
                <p className="text-2xl font-bold">{selectedOrders.length} orders</p>
                <p className="text-lg font-medium text-green-600">{selectedTotal.toFixed(2)} XCG total</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Notes (optional)</label>
                <Textarea
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  placeholder="Add any notes about this reconciliation..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReconcileDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReconcile} disabled={reconcileMutation.isPending}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm Reconciliation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Deposit Dialog */}
        <RecordDepositDialog
          open={!!depositDialogWallet}
          onOpenChange={(open) => !open && setDepositDialogWallet(null)}
          wallet={depositDialogWallet}
          onConfirm={handleDepositConfirm}
          isLoading={depositMutation.isPending}
        />

        {/* Transaction History Sheet */}
        <WalletTransactionHistory
          open={!!historyDriverId}
          onOpenChange={(open) => !open && setHistoryDriverId(null)}
          driverId={historyDriverId}
          driverName={historyDriverName}
        />
      </main>
    </div>
  );
}
