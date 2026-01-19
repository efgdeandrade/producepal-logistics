import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Phone, MapPin, Package, Clock, Banknote, Camera, Store, Upload, CreditCard, LayoutDashboard, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DriverAdminDashboard } from "@/components/driver/DriverAdminDashboard";

type PaymentMethodType = "cash" | "swipe" | "transfer" | "credit";

export default function FnbDriverPortal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasRole, isAdmin } = useAuth();
  const canSeeAdminDashboard = isAdmin() || hasRole("management");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [codDialogOrder, setCodDialogOrder] = useState<any>(null);
  const [codAmount, setCodAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("cash");
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [processingReceipt, setProcessingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch orders assigned to current driver
  const { data: myOrders, isLoading } = useQuery({
    queryKey: ["fnb-driver-orders", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("distribution_orders")
        .select(`
          *,
          distribution_customers (name, address, whatsapp_phone, customer_type),
          distribution_order_items (id, quantity, picked_quantity, short_quantity, product_id, distribution_products (name))
        `)
        .eq("driver_id", user.id)
        .in("status", ["out_for_delivery"])
        .order("delivery_date", { ascending: true }) as { data: any[] | null; error: any };
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch delivered orders (for history)
  const { data: deliveredOrders } = useQuery({
    queryKey: ["fnb-driver-delivered", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("distribution_orders")
        .select(`
          *,
          distribution_customers (name, address, customer_type)
        `)
        .eq("driver_id", user.id)
        .eq("status", "delivered")
        .gte("delivered_at", today)
        .order("delivered_at", { ascending: false }) as { data: any[] | null; error: any };
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Calculate today's COD total
  const todayCodTotal = deliveredOrders?.reduce((sum: number, order: any) => {
    return sum + (order.cod_amount_collected || 0);
  }, 0) || 0;

  // Upload receipt photo
  const uploadReceiptPhoto = async (orderId: string, file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${orderId}-${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from("delivery-receipts")
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    return fileName;
  };

  // Process receipt with AI (crop, enhance, extract data)
  const processReceiptWithAI = async (orderId: string, receiptPath: string) => {
    try {
      setProcessingReceipt(true);
      
      const { data, error } = await supabase.functions.invoke("receipt-processor", {
        body: { receiptPath, orderId }
      });
      
      if (error) {
        console.error("AI processing error:", error);
        toast.error("Receipt processing failed, but delivery was recorded");
      } else if (data?.extracted_data) {
        const extracted = data.extracted_data;
        if (extracted.has_signature) {
          toast.success("Receipt processed: Signature detected ✓");
        } else if (!extracted.parse_error) {
          toast.info("Receipt processed, but no signature detected");
        }
      }
    } catch (err) {
      console.error("Failed to process receipt:", err);
      // Don't fail the delivery for AI processing errors
    } finally {
      setProcessingReceipt(false);
    }
  };

  // Mark as delivered mutation with COD and receipt
  const markDeliveredMutation = useMutation({
    mutationFn: async ({ 
      orderId, 
      codCollected, 
      paymentMethod: method,
      receiptPhotoPath 
    }: { 
      orderId: string; 
      codCollected: number;
      paymentMethod: PaymentMethodType;
      receiptPhotoPath?: string;
    }) => {
      const { error } = await supabase
        .from("distribution_orders")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
          cod_amount_collected: codCollected,
          cod_collected_at: new Date().toISOString(),
          payment_method_used: method,
          receipt_photo_url: receiptPhotoPath || null,
        })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order delivered & recorded!");
      queryClient.invalidateQueries({ queryKey: ["fnb-driver-orders"] });
      queryClient.invalidateQueries({ queryKey: ["fnb-driver-delivered"] });
      resetDialog();
    },
    onError: (error) => {
      toast.error("Failed to update order: " + error.message);
    },
  });

  const resetDialog = () => {
    setCodDialogOrder(null);
    setCodAmount("");
    setPaymentMethod("cash");
    setReceiptPhoto(null);
  };

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`, "_self");
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}`, "_blank");
  };

  const openCodDialog = (order: any) => {
    setCodDialogOrder(order);
    setCodAmount(order.total_xcg?.toFixed(2) || "0");
    // Default payment method based on customer type
    if (order.distribution_customers?.customer_type === "credit") {
      setPaymentMethod("credit");
    } else {
      setPaymentMethod("cash");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptPhoto(file);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!codDialogOrder) return;
    
    const isSupermarket = codDialogOrder.distribution_customers?.customer_type === "supermarket";
    
    // Supermarket orders MUST have receipt photo
    if (isSupermarket && !receiptPhoto) {
      toast.error("Receipt photo is required for supermarket orders");
      return;
    }

    setUploadingReceipt(true);
    
    try {
      let receiptPhotoPath: string | undefined;
      const orderId = codDialogOrder.id;
      
      if (receiptPhoto) {
        receiptPhotoPath = await uploadReceiptPhoto(orderId, receiptPhoto);
      }

      const amount = parseFloat(codAmount) || 0;
      await markDeliveredMutation.mutateAsync({
        orderId,
        codCollected: amount,
        paymentMethod,
        receiptPhotoPath,
      });

      // Process receipt with AI in background (for supermarket orders)
      if (receiptPhotoPath && isSupermarket) {
        // Don't await - process in background
        processReceiptWithAI(orderId, receiptPhotoPath);
      }
    } catch (error: any) {
      toast.error("Failed to upload receipt: " + error.message);
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Render the driver deliveries content (used in both tab and non-tab views)
  const renderDriverDeliveries = () => (
    <div className="space-y-6">
      {/* Today's COD Summary */}
      {todayCodTotal > 0 && (
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-green-600" />
                <span className="font-medium">Today's COD Collected</span>
              </div>
              <span className="text-xl font-bold text-green-600">{todayCodTotal.toFixed(2)} XCG</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Deliveries */}
      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">Loading...</p>
      ) : myOrders?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">All done!</p>
            <p className="text-muted-foreground">No pending deliveries</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {myOrders?.map((order: any, index: number) => (
            <Card
              key={order.id}
              className="overflow-hidden"
              onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
            >
              <CardHeader className="pb-2 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{order.distribution_customers?.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{order.order_number}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <Badge variant="secondary">{order.distribution_order_items?.length} items</Badge>
                    {order.distribution_customers?.customer_type === 'supermarket' && (
                      <Badge variant="outline" className="text-purple-600 border-purple-300">
                        <Store className="h-3 w-3 mr-1" />
                        Supermarket
                      </Badge>
                    )}
                    {order.distribution_customers?.customer_type === 'cod' && (
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        <Banknote className="h-3 w-3 mr-1" />
                        COD
                      </Badge>
                    )}
                    {order.distribution_customers?.customer_type === 'credit' && (
                      <Badge variant="outline" className="text-blue-600 border-blue-300">
                        <CreditCard className="h-3 w-3 mr-1" />
                        Credit
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Address */}
                {order.distribution_customers?.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <span>{order.distribution_customers.address}</span>
                  </div>
                )}

                {/* Order Total */}
                <div className="flex items-center gap-2 text-sm">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{order.total_xcg?.toFixed(2)} XCG</span>
                </div>

                {/* Supermarket notice */}
                {order.distribution_customers?.customer_type === 'supermarket' && (
                  <div className="flex items-center gap-2 text-sm text-purple-600 bg-purple-50 dark:bg-purple-950 p-2 rounded">
                    <Camera className="h-4 w-4" />
                    <span>Receipt photo required</span>
                  </div>
                )}

                {/* Expanded details */}
                {expandedOrder === order.id && (
                  <div className="pt-2 border-t space-y-3">
                    {/* Items list */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Items:</p>
                      {order.distribution_order_items?.map((item: any) => (
                        <div key={item.id} className="text-sm flex justify-between pl-2">
                          <span>{item.distribution_products?.name}</span>
                          <span className="text-muted-foreground">
                            x{item.picked_quantity || item.quantity}
                            {item.short_quantity > 0 && (
                              <span className="text-destructive ml-1">(-{item.short_quantity})</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    {order.notes && (
                      <div className="text-sm">
                        <p className="font-medium">Notes:</p>
                        <p className="text-muted-foreground">{order.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  {order.distribution_customers?.whatsapp_phone && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCall(order.distribution_customers.whatsapp_phone);
                        }}
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        Call
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWhatsApp(order.distribution_customers.whatsapp_phone);
                        }}
                      >
                        WhatsApp
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCodDialog(order);
                    }}
                    disabled={markDeliveredMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Delivered
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Today's Completed */}
      {deliveredOrders && deliveredOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Completed Today ({deliveredOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deliveredOrders.map((order: any) => (
              <div key={order.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{order.distribution_customers?.name}</p>
                  <p className="text-muted-foreground">{order.order_number}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(order.delivered_at), "HH:mm")}
                  </div>
                  {order.cod_amount_collected > 0 && (
                    <p className="text-green-600 font-medium">{order.cod_amount_collected.toFixed(2)} XCG</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // If admin/management, show tabs with dashboard + deliveries
  if (canSeeAdminDashboard) {
    return (
      <div className="px-4 md:container py-4 space-y-6 w-full max-w-full overflow-x-hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/fnb")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Driver Portal</h1>
            <p className="text-muted-foreground">Manage drivers and deliveries</p>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              My Deliveries
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="mt-6">
            <DriverAdminDashboard />
          </TabsContent>
          
          <TabsContent value="deliveries" className="mt-6 max-w-lg">
            {renderDriverDeliveries()}
          </TabsContent>
        </Tabs>

        {/* COD Collection Dialog */}
        <Dialog open={!!codDialogOrder} onOpenChange={() => resetDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
              {codDialogOrder?.distribution_customers?.customer_type === 'supermarket' 
                ? 'Complete Supermarket Delivery' 
                : 'Record Payment & Delivery'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              <p>Customer: <span className="font-medium text-foreground">{codDialogOrder?.distribution_customers?.name}</span></p>
              <p>Order: <span className="font-medium text-foreground">{codDialogOrder?.order_number}</span></p>
              <p>Order Total: <span className="font-medium text-foreground">{codDialogOrder?.total_xcg?.toFixed(2)} XCG</span></p>
              {codDialogOrder?.distribution_customers?.customer_type && (
                <p>Type: <span className="font-medium text-foreground capitalize">{codDialogOrder.distribution_customers.customer_type}</span></p>
              )}
              </div>

              {/* Payment Method */}
              <div>
                <Label className="mb-2 block">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethodType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="swipe">Card Swipe</SelectItem>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                    <SelectItem value="credit">Credit (Invoice Later)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount - hide for credit */}
              {paymentMethod !== "credit" && (
                <div>
                  <Label className="mb-2 block">Amount Collected (XCG)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={codAmount}
                    onChange={(e) => setCodAmount(e.target.value)}
                    placeholder="Enter amount collected"
                    className="text-lg"
                  />
                </div>
              )}

              {/* Receipt Photo - Required for Supermarket */}
              {codDialogOrder?.distribution_customers?.customer_type === 'supermarket' && (
                <div>
                  <Label className="mb-2 block">
                    Signed Receipt Photo <span className="text-destructive">*</span>
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
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="flex-1 text-sm truncate">{receiptPhoto.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Take Photo of Signed Receipt
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Required: Photo of receipt signed by store representative
                  </p>
                </div>
              )}

              {/* Optional receipt for non-supermarket */}
              {codDialogOrder?.distribution_customers?.customer_type !== 'supermarket' && (
                <div>
                  <Label className="mb-2 block">Receipt Photo (Optional)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {receiptPhoto ? (
                    <div className="flex items-center gap-2 p-2 border rounded">
                      <Camera className="h-4 w-4 text-green-600" />
                      <span className="flex-1 text-sm truncate">{receiptPhoto.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => setReceiptPhoto(null)}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Add Photo
                    </Button>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => resetDialog()}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmDelivery} 
                disabled={markDeliveredMutation.isPending || uploadingReceipt}
              >
                {uploadingReceipt ? (
                  <>Uploading...</>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Delivery
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Regular driver view (no tabs, just deliveries)
  return (
    <div className="px-4 md:container py-4 space-y-6 max-w-lg w-full overflow-x-hidden">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/fnb")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">My Deliveries</h1>
          <p className="text-muted-foreground">
            {myOrders?.length || 0} orders to deliver
          </p>
        </div>
      </div>

      {renderDriverDeliveries()}

      {/* COD Collection Dialog */}
      <Dialog open={!!codDialogOrder} onOpenChange={() => resetDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {codDialogOrder?.distribution_customers?.customer_type === 'supermarket' 
                ? 'Complete Supermarket Delivery' 
                : 'Record Payment & Delivery'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              <p>Customer: <span className="font-medium text-foreground">{codDialogOrder?.distribution_customers?.name}</span></p>
              <p>Order: <span className="font-medium text-foreground">{codDialogOrder?.order_number}</span></p>
              <p>Order Total: <span className="font-medium text-foreground">{codDialogOrder?.total_xcg?.toFixed(2)} XCG</span></p>
              {codDialogOrder?.distribution_customers?.customer_type && (
                <p>Type: <span className="font-medium text-foreground capitalize">{codDialogOrder.distribution_customers.customer_type}</span></p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <Label className="mb-2 block">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethodType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="swipe">Card Swipe</SelectItem>
                  <SelectItem value="transfer">Bank Transfer</SelectItem>
                  <SelectItem value="credit">Credit (Invoice Later)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount - hide for credit */}
            {paymentMethod !== "credit" && (
              <div>
                <Label className="mb-2 block">Amount Collected (XCG)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={codAmount}
                  onChange={(e) => setCodAmount(e.target.value)}
                  placeholder="Enter amount collected"
                  className="text-lg"
                />
              </div>
            )}

            {/* Receipt Photo - Required for Supermarket */}
            {codDialogOrder?.distribution_customers?.customer_type === 'supermarket' && (
              <div>
                <Label className="mb-2 block">
                  Signed Receipt Photo <span className="text-destructive">*</span>
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
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="flex-1 text-sm truncate">{receiptPhoto.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo of Signed Receipt
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Required: Photo of receipt signed by store representative
                </p>
              </div>
            )}

            {/* Optional receipt for non-supermarket */}
            {codDialogOrder?.distribution_customers?.customer_type !== 'supermarket' && (
              <div>
                <Label className="mb-2 block">Receipt Photo (Optional)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {receiptPhoto ? (
                  <div className="flex items-center gap-2 p-2 border rounded">
                    <Camera className="h-4 w-4 text-green-600" />
                    <span className="flex-1 text-sm truncate">{receiptPhoto.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => setReceiptPhoto(null)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Add Photo
                  </Button>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => resetDialog()}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmDelivery} 
              disabled={markDeliveredMutation.isPending || uploadingReceipt}
            >
              {uploadingReceipt ? (
                <>Uploading...</>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Delivery
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
