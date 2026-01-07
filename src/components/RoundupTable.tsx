import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
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

export const RoundupTable = ({ order, orderItems, format }: Props) => {
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

  // Calculate totals per product
  const productTotals = orderItems.reduce((acc, item) => {
    if (!acc[item.product_code]) {
      acc[item.product_code] = 0;
    }
    acc[item.product_code] += item.quantity;
    return acc;
  }, {} as Record<string, number>);

  const containerClass = format === 'receipt' ? 'max-w-[80mm]' : 'max-w-[210mm]';
  const textSize = format === 'receipt' ? 'text-xs' : 'text-sm';

  return (
    <div className={`${containerClass} mx-auto bg-white text-black p-6`}>
      <div className="border-b-2 border-black pb-4 mb-4">
        <h1 className={`${format === 'receipt' ? 'text-lg' : 'text-2xl'} font-bold`}>ORDER ROUNDUP</h1>
        <div className={`${textSize} mt-2`}>
          <p><strong>Order #:</strong> {order.order_number}</p>
          <p><strong>Week:</strong> {order.week_number}</p>
          <p><strong>Delivery Date:</strong> {new Date(order.delivery_date).toLocaleDateString()}</p>
          <p><strong>Placed by:</strong> {order.placed_by}</p>
        </div>
      </div>

      <div className="mb-4">
        <h2 className={`${format === 'receipt' ? 'text-base' : 'text-xl'} font-bold mb-2`}>Total Products Summary</h2>
        <p className={`${textSize} text-gray-600`}>Use this checklist when receiving products at the distribution center</p>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black">
            <th className={`${textSize} text-left py-2`}>Product</th>
            <th className={`${textSize} text-right py-2`}>Trays</th>
            <th className={`${textSize} text-right py-2`}>Units</th>
            <th className={`${textSize} text-center py-2`}>✓</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(productTotals).map(([productCode, quantity]) => {
            const product = getProductInfo(productCode);
            const units = product ? quantity * product.pack_size : 0;
            return (
              <tr key={productCode} className="border-b border-gray-300">
                <td className={`${textSize} py-3`}>
                  <div className="font-semibold">{productCode}</div>
                  {product && <div className="text-gray-600">{product.name}</div>}
                </td>
                <td className={`${textSize} text-right py-3 font-semibold`}>{quantity}</td>
                <td className={`${textSize} text-right py-3`}>{units}</td>
                <td className={`${textSize} text-center py-3`}>
                  <div className="w-6 h-6 border-2 border-black mx-auto"></div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black">
            <td className={`${textSize} font-bold py-3`}>Grand Total</td>
            <td className={`${textSize} font-bold text-right py-3`}>
              {Object.values(productTotals).reduce((sum, qty) => sum + qty, 0)}
            </td>
            <td className={`${textSize} font-bold text-right py-3`}>
              {Object.entries(productTotals).reduce((sum, [code, qty]) => {
                const product = getProductInfo(code);
                return sum + (product ? qty * product.pack_size : 0);
              }, 0)}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div className={`${textSize} mt-6 pt-4 border-t border-gray-300 space-y-3`}>
        <div>
          <p className="font-semibold">Received by: _________________________</p>
        </div>
        <div>
          <p className="font-semibold">Date: _________________________</p>
        </div>
        <div>
          <p className="font-semibold">Time: _________________________</p>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-300">
          <p className="font-semibold mb-2">Notes / Discrepancies:</p>
          <div className="border border-gray-300 h-20"></div>
        </div>
      </div>
    </div>
  );
};
