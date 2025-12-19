import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Camera, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  ExternalLink,
  Store,
  User,
  Calendar
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function FnbReceiptVerification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

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

  // Fetch supermarket orders pending receipt verification
  const { data: pendingOrders, isLoading: loadingPending } = useQuery({
    queryKey: ["fnb-pending-receipts", dateFilter],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("fnb_orders")
        .select(`
          *,
          fnb_customers!inner (name, customer_type, address)
        `)
        .eq("status", "delivered")
        .eq("fnb_customers.customer_type", "supermarket")
        .is("receipt_verified_at", null)
        .gte("delivered_at", `${start}T00:00:00`)
        .lte("delivered_at", `${end}T23:59:59`)
        .order("delivered_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch verified orders for history
  const { data: verifiedOrders, isLoading: loadingVerified } = useQuery({
    queryKey: ["fnb-verified-receipts", dateFilter],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("fnb_orders")
        .select(`
          *,
          fnb_customers!inner (name, customer_type)
        `)
        .eq("status", "delivered")
        .eq("fnb_customers.customer_type", "supermarket")
        .not("receipt_verified_at", "is", null)
        .gte("receipt_verified_at", `${start}T00:00:00`)
        .lte("receipt_verified_at", `${end}T23:59:59`)
        .order("receipt_verified_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Verify receipt mutation
  const verifyReceiptMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("fnb_orders")
        .update({
          receipt_verified_at: new Date().toISOString(),
          receipt_verified_by: user?.id,
        })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Receipt verified successfully");
      queryClient.invalidateQueries({ queryKey: ["fnb-pending-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["fnb-verified-receipts"] });
      setSelectedOrder(null);
    },
    onError: (error) => {
      toast.error("Failed to verify receipt: " + error.message);
    },
  });

  const handleVerify = (orderId: string) => {
    verifyReceiptMutation.mutate(orderId);
  };

  const getReceiptUrl = (path: string) => {
    const { data } = supabase.storage.from("delivery-receipts").getPublicUrl(path);
    return data.publicUrl;
  };

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
            <h1 className="text-3xl font-bold tracking-tight">Receipt Verification</h1>
            <p className="text-muted-foreground">
              Verify signed receipts from supermarket deliveries before creating QB invoices
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Pending Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingOrders?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting receipt check</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Verified ({dateFilter})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{verifiedOrders?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Ready for QB invoice</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
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
            </div>
          </CardContent>
        </Card>

        {/* Pending Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Pending Receipt Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPending ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : pendingOrders?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No pending receipts to verify
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingOrders?.map((order) => (
                  <Card key={order.id} className="border-l-4 border-l-orange-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <p className="font-medium">{order.fnb_customers?.name}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">{order.order_number}</p>
                        </div>
                        <Badge variant="secondary">{order.total_xcg?.toFixed(2)} XCG</Badge>
                      </div>
                      
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          <span>Driver: {order.driver_name || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Delivered: {order.delivered_at && format(new Date(order.delivered_at), "MMM d, HH:mm")}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        {order.receipt_photo_url ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => setViewingReceipt(order.receipt_photo_url)}
                            >
                              <Camera className="h-4 w-4 mr-1" />
                              View Receipt
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => handleVerify(order.id)}
                              disabled={verifyReceiptMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Verify
                            </Button>
                          </>
                        ) : (
                          <Badge variant="destructive" className="w-full justify-center py-2">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            No receipt uploaded
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verified Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Verified Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingVerified ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : verifiedOrders?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No verified receipts for this period
              </p>
            ) : (
              <div className="space-y-2">
                {verifiedOrders?.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">{order.fnb_customers?.name}</p>
                        <p className="text-sm text-muted-foreground">{order.order_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">{order.total_xcg?.toFixed(2)} XCG</p>
                        <p className="text-xs text-muted-foreground">
                          Verified: {order.receipt_verified_at && format(new Date(order.receipt_verified_at), "HH:mm")}
                        </p>
                      </div>
                      {order.quickbooks_invoice_id ? (
                        <Badge variant="outline" className="text-blue-600 border-blue-300">
                          QB Synced
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          Ready for QB
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt Image Dialog */}
        <Dialog open={!!viewingReceipt} onOpenChange={() => setViewingReceipt(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Receipt Photo</DialogTitle>
            </DialogHeader>
            {viewingReceipt && (
              <div className="flex justify-center">
                <img
                  src={getReceiptUrl(viewingReceipt)}
                  alt="Receipt"
                  className="max-h-[60vh] object-contain rounded-lg"
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingReceipt(null)}>
                Close
              </Button>
              {viewingReceipt && (
                <Button asChild>
                  <a href={getReceiptUrl(viewingReceipt)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Full Size
                  </a>
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
