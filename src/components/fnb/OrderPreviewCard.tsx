import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, CheckCircle, Edit2, X } from 'lucide-react';
import { useState } from 'react';

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  confidence?: number;
  matched_product_id?: string;
}

interface OrderPreviewCardProps {
  customerName: string;
  orderNumber?: string;
  deliveryDate?: string;
  poNumber?: string;
  items: OrderItem[];
  total: number;
  onConfirm: () => void;
  onEdit?: (items: OrderItem[]) => void;
  onCancel: () => void;
  confirming?: boolean;
}

function getConfidenceBadge(confidence?: number) {
  if (!confidence) return null;
  if (confidence >= 0.9) {
    return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">High</Badge>;
  }
  if (confidence >= 0.7) {
    return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Medium</Badge>;
  }
  return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Low</Badge>;
}

export function OrderPreviewCard({
  customerName,
  orderNumber,
  deliveryDate,
  poNumber,
  items,
  total,
  onConfirm,
  onEdit,
  onCancel,
  confirming = false,
}: OrderPreviewCardProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedItems, setEditedItems] = useState<OrderItem[]>(items);

  const hasLowConfidence = items.some(item => item.confidence && item.confidence < 0.7);
  const hasMissingMatches = items.some(item => !item.matched_product_id);

  const handleQuantityChange = (index: number, newQty: number) => {
    const updated = [...editedItems];
    updated[index] = {
      ...updated[index],
      quantity: newQty,
      total: newQty * updated[index].unit_price,
    };
    setEditedItems(updated);
  };

  const handleSaveEdit = () => {
    onEdit?.(editedItems);
    setEditingIndex(null);
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Order Preview</CardTitle>
          <div className="flex items-center gap-2">
            {hasLowConfidence && (
              <Badge variant="outline" className="gap-1 text-yellow-600">
                <AlertTriangle className="h-3 w-3" />
                Review Needed
              </Badge>
            )}
            {hasMissingMatches && (
              <Badge variant="outline" className="gap-1 text-red-600">
                <AlertTriangle className="h-3 w-3" />
                Unmatched Items
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Customer:</span>
            <p className="font-medium">{customerName}</p>
          </div>
          {orderNumber && (
            <div>
              <span className="text-muted-foreground">Order #:</span>
              <p className="font-medium">{orderNumber}</p>
            </div>
          )}
          {deliveryDate && (
            <div>
              <span className="text-muted-foreground">Delivery Date:</span>
              <p className="font-medium">{deliveryDate}</p>
            </div>
          )}
          {poNumber && (
            <div>
              <span className="text-muted-foreground">PO #:</span>
              <p className="font-medium">{poNumber}</p>
            </div>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Product</th>
                <th className="text-right p-2">Qty</th>
                <th className="text-right p-2">Price</th>
                <th className="text-right p-2">Total</th>
                <th className="text-center p-2 w-20">Match</th>
              </tr>
            </thead>
            <tbody>
              {editedItems.map((item, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {item.matched_product_id ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      <span className={!item.matched_product_id ? 'text-red-600' : ''}>
                        {item.product_name}
                      </span>
                    </div>
                  </td>
                  <td className="text-right p-2">
                    {editingIndex === index ? (
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                        className="w-20 h-7 text-right"
                        min={0}
                      />
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <span>{item.quantity}</span>
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setEditingIndex(index)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="text-right p-2">ƒ {item.unit_price.toFixed(2)}</td>
                  <td className="text-right p-2 font-medium">
                    ƒ {(editingIndex === index ? item.quantity * item.unit_price : item.total).toFixed(2)}
                  </td>
                  <td className="text-center p-2">
                    {getConfidenceBadge(item.confidence)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted">
              <tr>
                <td colSpan={3} className="text-right p-2 font-medium">Total:</td>
                <td className="text-right p-2 font-bold">
                  ƒ {editedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {editingIndex !== null && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingIndex(null)}>
              Cancel Edit
            </Button>
            <Button size="sm" onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={confirming}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={confirming || hasMissingMatches}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {confirming ? 'Creating Order...' : 'Confirm & Create Order'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
