import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  po_number?: string;
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
  customerName: string;
  format: 'a4' | 'receipt';
}

interface Product {
  code: string;
  name: string;
  pack_size: number;
  retail_price_usd_per_unit: number | null;
  retail_price_xcg_per_unit: number | null;
}

interface Customer {
  id: string;
  name: string;
}

export const CustomerReceipt = ({ order, orderItems, customerName, format }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [customerName]);

  const fetchData = async () => {
    setLoading(true);
    const { data: productsData } = await supabase
      .from('products')
      .select('code, name, pack_size, retail_price_usd_per_unit, retail_price_xcg_per_unit');
    if (productsData) setProducts(productsData);

    const { data: customerData } = await supabase
      .from('customers')
      .select('id, name')
      .eq('name', customerName)
      .single();
    if (customerData) setCustomer(customerData);
    setLoading(false);
  };

  const getProductInfo = (code: string) => {
    return products.find(p => p.code === code);
  };

  const customerItems = orderItems.filter(item => item.customer_name === customerName);

  const calculateTotal = () => {
    return customerItems.reduce((sum, item) => {
      const product = getProductInfo(item.product_code);
      if (!product || !product.retail_price_usd_per_unit) return sum;
      const units = item.quantity * product.pack_size;
      return sum + (units * product.retail_price_usd_per_unit);
    }, 0);
  };

  const containerClass = format === 'receipt' ? 'max-w-[80mm]' : 'max-w-[210mm]';
  const textSize = format === 'receipt' ? 'text-xs' : 'text-sm';

  if (loading) {
    return (
      <div className={`${containerClass} mx-auto bg-white text-black p-6`}>
        <div className="text-center py-8">Loading receipt data...</div>
      </div>
    );
  }

  return (
    <div className={`${containerClass} mx-auto bg-white text-black p-6`}>
      <div className="border-b-2 border-black pb-4 mb-4">
        <h1 className={`${format === 'receipt' ? 'text-lg' : 'text-2xl'} font-bold text-center`}>RECEIPT</h1>
        <div className={`${textSize} mt-2`}>
          <p><strong>Receipt #:</strong> {order.order_number}-{customerName.replace(/\s+/g, '-').substring(0, 10)}</p>
          <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
          <p><strong>Order #:</strong> {order.order_number}</p>
        </div>
      </div>

      <div className="mb-4">
        <h2 className={`${format === 'receipt' ? 'text-base' : 'text-xl'} font-bold mb-2`}>Bill To</h2>
        <p className={`${textSize} font-semibold`}>{customerName}</p>
        {customerItems[0]?.po_number && (
          <p className={`${textSize}`}><strong>PO #:</strong> {customerItems[0].po_number}</p>
        )}
      </div>

      <table className="w-full border-collapse mb-4">
        <thead>
          <tr className="border-b-2 border-black">
            <th className={`${textSize} text-left py-2`}>Item</th>
            <th className={`${textSize} text-right py-2`}>Qty</th>
            <th className={`${textSize} text-right py-2`}>Price</th>
            <th className={`${textSize} text-right py-2`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {customerItems.map((item) => {
            const product = getProductInfo(item.product_code);
            const units = product ? item.quantity * product.pack_size : 0;
            const price = product?.retail_price_usd_per_unit || 0;
            const lineTotal = units * price;
            
            return (
              <tr key={item.id} className="border-b border-gray-300">
                <td className={`${textSize} py-2`}>
                  <div className="font-medium">{item.product_code}</div>
                  {product && <div className="text-gray-600 text-xs">{product.name}</div>}
                  <div className="text-gray-500 text-xs">{item.quantity} trays × {product?.pack_size} = {units} units</div>
                </td>
                <td className={`${textSize} text-right py-2`}>{units}</td>
                <td className={`${textSize} text-right py-2`}>${price.toFixed(2)}</td>
                <td className={`${textSize} text-right py-2`}>${lineTotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black">
            <td colSpan={3} className={`${textSize} font-bold py-2 text-right`}>Total Amount Due:</td>
            <td className={`${textSize} font-bold text-right py-2`}>${calculateTotal().toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <div className={`${textSize} mt-6 pt-4 border-t border-gray-300`}>
        <p className="text-center font-semibold mb-2">Payment Information</p>
        <p>Payment Method: _________________________</p>
        <p className="mt-2">Signature: _________________________</p>
        <p className="mt-4 text-center text-xs">Thank you for your business!</p>
      </div>
    </div>
  );
};
