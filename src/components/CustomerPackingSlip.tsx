import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCuracao } from '@/lib/dateUtils';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  po_number?: string;
  customer_notes?: string;
  stock_quantity?: number | null;
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
  const textSize = format === 'receipt' ? 'text-sm' : 'text-base';

  return (
    <div className="space-y-8">
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .high-contrast-print {
            font-family: Arial, Helvetica, sans-serif !important;
          }
          .high-contrast-print * {
            color: #000 !important;
            font-weight: 600 !important;
          }
          .high-contrast-print h1,
          .high-contrast-print h2,
          .high-contrast-print .font-bold,
          .high-contrast-print .font-extrabold,
          .high-contrast-print th,
          .high-contrast-print tfoot td {
            font-weight: 900 !important;
          }
          .high-contrast-print table {
            border-collapse: collapse;
          }
          .high-contrast-print tr {
            border-bottom: 2px solid #000 !important;
          }
          .page-break {
            page-break-after: always;
          }
          .page-break:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
      {Object.entries(groupedByCustomer).map(([customerName, items], index) => (
        <div 
          key={customerName} 
          data-customer={customerName}
          className={`${containerClass} mx-auto bg-white text-black p-6 page-break high-contrast-print font-sans`}
        >
          <div className="border-b-4 border-black pb-4 mb-4">
            <h1 className={`${format === 'receipt' ? 'text-xl' : 'text-3xl'} font-extrabold`}>PACKING SLIP</h1>
            <div className={`${textSize} mt-2 font-bold`}>
              <p><strong>Order #:</strong> {order.order_number}</p>
              <p><strong>Week:</strong> {order.week_number}</p>
              <p><strong>Delivery Date:</strong> {formatCuracao(order.delivery_date, 'PPP')}</p>
            </div>
          </div>

          <div className="mb-4">
            <h2 className={`${format === 'receipt' ? 'text-lg' : 'text-2xl'} font-extrabold mb-2`}>Customer</h2>
            <p className={`${textSize} font-bold`}>{customerName}</p>
            {items[0].po_number && (
              <p className={`${textSize} font-bold`}><strong>PO #:</strong> {items[0].po_number}</p>
            )}
            {items[0].customer_notes && (
              <p className={`${textSize} mt-2 p-2 bg-amber-50 border-l-4 border-black font-bold`}>
                <strong>Notes:</strong> {items[0].customer_notes}
              </p>
            )}
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-4 border-black">
                <th className={`${textSize} text-left py-2 font-extrabold`}>Product</th>
                <th className={`${textSize} text-right py-2 font-extrabold`}>Trays</th>
                <th className={`${textSize} text-right py-2 font-extrabold`}>Units</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const product = getProductInfo(item.product_code);
                const units = product ? item.quantity * product.pack_size : 0;
                return (
                  <tr key={item.id} className="border-b-2 border-black">
                    <td className={`${textSize} py-2`}>
                      <div className="font-bold">{item.product_code}</div>
                      {product && <div className="text-black font-bold">{product.name}</div>}
                    </td>
                    <td className={`${textSize} text-right py-2 font-bold`}>{item.quantity}</td>
                    <td className={`${textSize} text-right py-2 font-bold`}>{units}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-4 border-black">
                <td className={`${textSize} font-extrabold py-2`}>Total</td>
                <td className={`${textSize} font-extrabold text-right py-2`}>
                  {items.reduce((sum, item) => sum + item.quantity + (item.stock_quantity ?? 0), 0)}
                </td>
                <td className={`${textSize} font-extrabold text-right py-2`}>
                  {items.reduce((sum, item) => {
                    const product = getProductInfo(item.product_code);
                    const totalQty = item.quantity + (item.stock_quantity ?? 0);
                    return sum + (product ? totalQty * product.pack_size : 0);
                  }, 0)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className={`${textSize} mt-6 pt-4 border-t-2 border-black`}>
            <p className="font-bold">Signature: _________________________</p>
            <p className="mt-2 font-bold">Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
