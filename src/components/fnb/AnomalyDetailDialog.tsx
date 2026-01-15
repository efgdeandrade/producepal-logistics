import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy,
  MessageCircle,
  Check,
  X,
  ExternalLink,
  ShoppingCart,
  Package,
  UserX,
  AlertTriangle,
  Calendar,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Anomaly {
  id: string;
  customer_id: string;
  anomaly_type: string;
  severity: string;
  detected_at: string;
  expected_date: string;
  details: any;
  suggested_message_en: string;
  suggested_message_pap: string;
  suggested_message_nl: string;
  suggested_message_es: string;
  status: string;
  distribution_customers?: {
    name: string;
    whatsapp_phone: string;
    preferred_language: string;
  };
}

interface AnomalyDetailDialogProps {
  anomaly: Anomaly | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (status: string) => void;
}

export function AnomalyDetailDialog({
  anomaly,
  open,
  onOpenChange,
  onStatusChange,
}: AnomalyDetailDialogProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");

  if (!anomaly) return null;

  const getMessage = () => {
    switch (selectedLanguage) {
      case "en":
        return anomaly.suggested_message_en || "";
      case "es":
        return anomaly.suggested_message_es || "";
      case "pap":
        return anomaly.suggested_message_pap || "";
      case "nl":
        return anomaly.suggested_message_nl || "";
      default:
        return anomaly.suggested_message_en || "";
    }
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(getMessage());
    toast.success("Message copied to clipboard");
  };

  const openWhatsApp = () => {
    const phone = anomaly.distribution_customers?.whatsapp_phone?.replace(/\D/g, "") || "";
    const message = encodeURIComponent(getMessage());
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  const getTypeIcon = () => {
    switch (anomaly.anomaly_type) {
      case "missing_order":
        return <ShoppingCart className="h-5 w-5" />;
      case "missing_item":
        return <Package className="h-5 w-5" />;
      case "inactive_customer":
        return <UserX className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getTypeTitle = () => {
    switch (anomaly.anomaly_type) {
      case "missing_order":
        return "Missing Expected Order";
      case "missing_item":
        return "Missing Item in Order";
      case "inactive_customer":
        return "Inactive Customer";
      case "quantity_change":
        return "Unusual Quantity Change";
      default:
        return "Order Anomaly";
    }
  };

  const getSeverityColor = () => {
    switch (anomaly.severity) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${
              anomaly.severity === "high" 
                ? "bg-destructive/10 text-destructive" 
                : anomaly.severity === "medium"
                ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30"
                : "bg-muted text-muted-foreground"
            }`}>
              {getTypeIcon()}
            </div>
            <div>
              <span>{getTypeTitle()}</span>
              <Badge variant={getSeverityColor() as any} className="ml-2">
                {anomaly.severity}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <div className="p-4 rounded-lg bg-muted/50">
            <h3 className="font-semibold text-lg mb-2">
              {anomaly.details?.customer_name || "Unknown Customer"}
            </h3>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Expected: {format(new Date(anomaly.expected_date), "EEEE, MMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Detected: {format(new Date(anomaly.detected_at), "h:mm a")}</span>
              </div>
            </div>
          </div>

          {/* Anomaly Details */}
          <div className="space-y-3">
            <h4 className="font-medium">What happened:</h4>
            <div className="p-4 rounded-lg border">
              {anomaly.anomaly_type === "missing_order" && (
                <div>
                  <p className="text-sm">
                    This customer typically orders on <strong>{anomaly.details?.expected_days_names}</strong>, 
                    but no order was received today.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Based on {anomaly.details?.total_orders} historical orders • 
                    Confidence: {Math.round((anomaly.details?.confidence || 0) * 100)}%
                  </p>
                </div>
              )}
              {anomaly.anomaly_type === "missing_item" && (
                <div>
                  <p className="text-sm">
                    Order received but missing <strong>{anomaly.details?.product_name}</strong> which they 
                    usually order ({anomaly.details?.usual_quantity} units, ordered {anomaly.details?.times_ordered} times).
                  </p>
                </div>
              )}
              {anomaly.anomaly_type === "inactive_customer" && (
                <div>
                  <p className="text-sm">
                    It's been <strong>{anomaly.details?.days_since_last_order} days</strong> since 
                    their last order on {anomaly.details?.last_order_date}.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Suggested Messages */}
          <div className="space-y-3">
            <h4 className="font-medium">Suggested message:</h4>
            <Tabs value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <TabsList>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="es">Español</TabsTrigger>
                <TabsTrigger value="pap">Papiamentu</TabsTrigger>
                <TabsTrigger value="nl">Dutch</TabsTrigger>
              </TabsList>
              <TabsContent value={selectedLanguage} className="mt-3">
                <Textarea
                  value={getMessage()}
                  readOnly
                  className="min-h-[120px] resize-none"
                />
              </TabsContent>
            </Tabs>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyMessage}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Message
              </Button>
              <Button onClick={openWhatsApp} className="bg-green-600 hover:bg-green-700">
                <MessageCircle className="h-4 w-4 mr-2" />
                Open WhatsApp
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Status: <Badge variant="outline">{anomaly.status}</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  onStatusChange("dismissed");
                  onOpenChange(false);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Dismiss
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onStatusChange("contacted");
                  onOpenChange(false);
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Mark Contacted
              </Button>
              <Button
                onClick={() => {
                  onStatusChange("resolved");
                  onOpenChange(false);
                }}
              >
                <Check className="h-4 w-4 mr-2" />
                Resolved
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
