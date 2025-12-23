import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Navigation, 
  Phone, 
  MessageCircle, 
  CheckCircle, 
  MapPin, 
  Package,
  Banknote,
  Store,
  CreditCard,
  ChevronRight
} from "lucide-react";

interface DeliveryOrder {
  id: string;
  order_number: string;
  total_xcg: number | null;
  notes: string | null;
  fnb_customers: {
    name: string;
    address: string | null;
    whatsapp_phone: string;
    customer_type: string;
  } | null;
  fnb_order_items: Array<{
    id: string;
    quantity: number;
    picked_quantity: number | null;
    short_quantity: number | null;
    fnb_products: { name: string } | null;
  }>;
}

interface DeliveryCardProps {
  order: DeliveryOrder;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onNavigate: (address: string | null) => void;
  onCall: (phone: string) => void;
  onWhatsApp: (phone: string) => void;
  onDeliver: () => void;
}

export default function DeliveryCard({
  order,
  index,
  isSelected,
  onSelect,
  onNavigate,
  onCall,
  onWhatsApp,
  onDeliver,
}: DeliveryCardProps) {
  const customer = order.fnb_customers;
  const customerType = customer?.customer_type || 'cod';

  const getCustomerTypeIcon = () => {
    switch (customerType) {
      case 'supermarket':
        return <Store className="h-3 w-3" />;
      case 'credit':
        return <CreditCard className="h-3 w-3" />;
      default:
        return <Banknote className="h-3 w-3" />;
    }
  };

  const getCustomerTypeColor = () => {
    switch (customerType) {
      case 'supermarket':
        return 'text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950';
      case 'credit':
        return 'text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950';
      default:
        return 'text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950';
    }
  };

  return (
    <div
      className={`
        rounded-xl border bg-card overflow-hidden transition-all duration-200
        ${isSelected ? 'ring-2 ring-primary shadow-lg' : 'shadow-sm'}
      `}
    >
      {/* Header - Always visible */}
      <div 
        className="flex items-center gap-3 p-4 cursor-pointer active:bg-muted/50"
        onClick={onSelect}
      >
        {/* Stop number */}
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
          ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-orange-500 text-white'}
        `}>
          {index + 1}
        </div>

        {/* Customer info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{customer?.name}</h3>
            <Badge variant="outline" className={`flex-shrink-0 text-xs ${getCustomerTypeColor()}`}>
              {getCustomerTypeIcon()}
              <span className="ml-1 capitalize">{customerType}</span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">{order.order_number}</p>
        </div>

        {/* Amount and chevron */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="font-semibold">{order.total_xcg?.toFixed(0)} XCG</p>
            <p className="text-xs text-muted-foreground">{order.fnb_order_items?.length} items</p>
          </div>
          <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
        </div>
      </div>

      {/* Expanded content */}
      {isSelected && (
        <div className="border-t">
          {/* Address */}
          {customer?.address && (
            <div className="px-4 py-3 flex items-start gap-2 bg-muted/30">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm">{customer.address}</p>
            </div>
          )}

          {/* Items preview */}
          <div className="px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" />
              Order Items
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {order.fnb_order_items?.slice(0, 6).map((item) => (
                <div key={item.id} className="text-sm flex justify-between">
                  <span className="truncate">{item.fnb_products?.name}</span>
                  <span className="text-muted-foreground ml-1">×{item.picked_quantity || item.quantity}</span>
                </div>
              ))}
              {order.fnb_order_items && order.fnb_order_items.length > 6 && (
                <p className="text-xs text-muted-foreground col-span-2">
                  +{order.fnb_order_items.length - 6} more items
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="px-4 py-2 bg-muted/20 text-sm text-muted-foreground">
              <span className="font-medium">Note:</span> {order.notes}
            </div>
          )}

          {/* Action buttons */}
          <div className="p-4 pt-3 grid grid-cols-4 gap-2">
            <Button
              variant="outline"
              size="lg"
              className="flex flex-col items-center gap-1 h-auto py-3"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(customer?.address || null);
              }}
            >
              <Navigation className="h-5 w-5 text-primary" />
              <span className="text-xs">Navigate</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="flex flex-col items-center gap-1 h-auto py-3"
              onClick={(e) => {
                e.stopPropagation();
                if (customer?.whatsapp_phone) onCall(customer.whatsapp_phone);
              }}
              disabled={!customer?.whatsapp_phone}
            >
              <Phone className="h-5 w-5" />
              <span className="text-xs">Call</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="flex flex-col items-center gap-1 h-auto py-3"
              onClick={(e) => {
                e.stopPropagation();
                if (customer?.whatsapp_phone) onWhatsApp(customer.whatsapp_phone);
              }}
              disabled={!customer?.whatsapp_phone}
            >
              <MessageCircle className="h-5 w-5 text-green-500" />
              <span className="text-xs">WhatsApp</span>
            </Button>

            <Button
              size="lg"
              className="flex flex-col items-center gap-1 h-auto py-3 bg-success hover:bg-success/90"
              onClick={(e) => {
                e.stopPropagation();
                onDeliver();
              }}
            >
              <CheckCircle className="h-5 w-5" />
              <span className="text-xs">Deliver</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
