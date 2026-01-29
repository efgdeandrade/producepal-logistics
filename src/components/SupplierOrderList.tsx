import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  is_from_stock?: boolean;
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
  supplier_id?: string;
}

interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
}

export const SupplierOrderList = ({ order, orderItems, format }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: productsData } = await supabase
      .from('products')
      .select('code, name, pack_size, supplier_id');
    
    const { data: suppliersData } = await supabase
      .from('suppliers')
      .select('*');
    
    if (productsData) setProducts(productsData);
    if (suppliersData) setSuppliers(suppliersData);
  };

  const getProductInfo = (code: string) => {
    return products.find(p => p.code === code);
  };

  const getSupplier = (supplierId?: string) => {
    return suppliers.find(s => s.id === supplierId);
  };

  // Group items by supplier
  const groupedBySupplier = orderItems.reduce((acc, item) => {
    const product = getProductInfo(item.product_code);
    const supplierId = product?.supplier_id || 'unassigned';
    const supplierName = supplierId === 'unassigned' 
      ? 'Unassigned Supplier' 
      : getSupplier(supplierId)?.name || 'Unknown Supplier';

    if (!acc[supplierName]) {
      acc[supplierName] = { supplier: getSupplier(supplierId), items: [] };
    }
    acc[supplierName].items.push(item);
    return acc;
  }, {} as Record<string, { supplier?: Supplier; items: OrderItem[] }>);

  const containerClass = format === 'receipt' ? 'max-w-[80mm]' : 'max-w-[210mm]';
  const textSize = format === 'receipt' ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-8">
      {Object.entries(groupedBySupplier).map(([supplierName, { supplier, items }]) => {
        // Calculate totals per product
        const productTotals = items.reduce((acc, item) => {
          if (!acc[item.product_code]) {
            acc[item.product_code] = 0;
          }
          acc[item.product_code] += item.quantity;
          return acc;
        }, {} as Record<string, number>);

        return (
          <div key={supplierName} data-supplier={supplierName} className={`${containerClass} mx-auto bg-white text-black p-6 page-break`}>
            <div className="border-b-2 border-black pb-4 mb-4">
              <h1 className={`${format === 'receipt' ? 'text-lg' : 'text-2xl'} font-bold`}>SUPPLIER ORDER</h1>
              <div className={`${textSize} mt-2`}>
                <p><strong>Order #:</strong> {order.order_number}</p>
                <p><strong>Week:</strong> {order.week_number}</p>
                <p><strong>Delivery Date:</strong> {new Date(order.delivery_date).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mb-4">
              <h2 className={`${format === 'receipt' ? 'text-base' : 'text-xl'} font-bold mb-2`}>Supplier</h2>
              <p className={`${textSize} font-semibold`}>{supplierName}</p>
              {supplier?.contact && <p className={`${textSize}`}>Contact: {supplier.contact}</p>}
              {supplier?.email && <p className={`${textSize}`}>Email: {supplier.email}</p>}
              {supplier?.phone && <p className={`${textSize}`}>Phone: {supplier.phone}</p>}
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
                {Object.entries(productTotals).map(([productCode, quantity]) => {
                  const product = getProductInfo(productCode);
                  const units = product ? quantity * product.pack_size : 0;
                  return (
                    <tr key={productCode} className="border-b border-gray-300">
                      <td className={`${textSize} py-2`}>
                        <div>{productCode}</div>
                        {product && <div className="text-gray-600">{product.name}</div>}
                      </td>
                      <td className={`${textSize} text-right py-2`}>{quantity}</td>
                      <td className={`${textSize} text-right py-2`}>{units}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black">
                  <td className={`${textSize} font-bold py-2`}>Total</td>
                  <td className={`${textSize} font-bold text-right py-2`}>
                    {Object.values(productTotals).reduce((sum, qty) => sum + qty, 0)}
                  </td>
                  <td className={`${textSize} font-bold text-right py-2`}>
                    {Object.entries(productTotals).reduce((sum, [code, qty]) => {
                      const product = getProductInfo(code);
                      return sum + (product ? qty * product.pack_size : 0);
                    }, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className={`${textSize} mt-6`}>
              <p className="font-semibold mb-2">Order Details:</p>
              <p>Placed by: {order.placed_by}</p>
              <p>Date: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        );
      })}
      
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
