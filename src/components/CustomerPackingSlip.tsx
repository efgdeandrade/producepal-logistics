import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  po_number?: string;
  customer_notes?: string;
}

interface Order {
  id: string;
  order_number: string;
  week_number: number;
  delivery_date: string;
  placed_by: string;
}

interface Props {
  order: Order;
  orderItems: OrderItem[];
  format: 'a4' | 'receipt';
}

interface Product {
  code: string;
  name: string;
  pack_size: number;
}

export const CustomerPackingSlip = ({ order, orderItems, format }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('code, name, pack_size');
    if (data) setProducts(data);
  };

  const getProductInfo = (code: string) => {
    return products.find(p => p.code === code);
  };

  const groupedByCustomer = orderItems.reduce((acc, item) => {
    if (!acc[item.customer_name]) {
      acc[item.customer_name] = [];
    }
    acc[item.customer_name].push(item);
    return acc;
  }, {} as Record<string, OrderItem[]>);

  const containerClass = format === 'receipt' ? 'max-w-[80mm]' : 'max-w-[210mm]';
  const textSize = format === 'receipt' ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-8">
      {Object.entries(groupedByCustomer).map(([customerName, items]) => (
        <div key={customerName} className={`${containerClass} mx-auto bg-white text-black p-6 page-break`}>
          <div className="border-b-2 border-black pb-4 mb-4">
            <h1 className={`${format === 'receipt' ? 'text-lg' : 'text-2xl'} font-bold`}>PACKING SLIP</h1>
            <div className={`${textSize} mt-2`}>
              <p><strong>Order #:</strong> {order.order_number}</p>
              <p><strong>Week:</strong> {order.week_number}</p>
              <p><strong>Delivery Date:</strong> {new Date(order.delivery_date).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mb-4">
            <h2 className={`${format === 'receipt' ? 'text-base' : 'text-xl'} font-bold mb-2`}>Customer</h2>
            <p className={`${textSize} font-semibold`}>{customerName}</p>
            {items[0].po_number && (
              <p className={`${textSize}`}><strong>PO #:</strong> {items[0].po_number}</p>
            )}
            {items[0].customer_notes && (
              <p className={`${textSize} mt-2 p-2 bg-amber-50 border-l-4 border-amber-400 italic`}>
                <strong>Notes:</strong> {items[0].customer_notes}
              </p>
            )}
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className={`${textSize} text-left py-2`}>Product</th>
                <th className={`${textSize} text-right py-2`}>Trays</th>
                <th className={`${textSize} text-right py-2`}>Units</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const product = getProductInfo(item.product_code);
                const units = product ? item.quantity * product.pack_size : 0;
                return (
                  <tr key={item.id} className="border-b border-gray-300">
                    <td className={`${textSize} py-2`}>
                      <div>{item.product_code}</div>
                      {product && <div className="text-gray-600">{product.name}</div>}
                    </td>
                    <td className={`${textSize} text-right py-2`}>{item.quantity}</td>
                    <td className={`${textSize} text-right py-2`}>{units}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black">
                <td className={`${textSize} font-bold py-2`}>Total</td>
                <td className={`${textSize} font-bold text-right py-2`}>
                  {items.reduce((sum, item) => sum + item.quantity, 0)}
                </td>
                <td className={`${textSize} font-bold text-right py-2`}>
                  {items.reduce((sum, item) => {
                    const product = getProductInfo(item.product_code);
                    return sum + (product ? item.quantity * product.pack_size : 0);
                  }, 0)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className={`${textSize} mt-6 pt-4 border-t border-gray-300`}>
            <p>Signature: _________________________</p>
            <p className="mt-2">Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      ))}
      
      <style>{`
        @media print {
          .page-break {
            page-break-after: always;
          }
          .page-break:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
};
