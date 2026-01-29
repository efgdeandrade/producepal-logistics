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
  receiptNumber?: string;
}

interface Product {
  code: string;
  name: string;
  pack_size: number;
  wholesale_price_xcg_per_unit: number | null;
}

interface Customer {
  id: string;
  name: string;
}

export const CustomerReceipt = ({ order, orderItems, customerName, format, receiptNumber }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [customerName]);

  const fetchData = async () => {
    setLoading(true);
    const { data: productsData } = await supabase
      .from('products')
      .select('code, name, pack_size, wholesale_price_xcg_per_unit');
    if (productsData) setProducts(productsData);

    const { data: customerData } = await supabase
      .from('customers')
      .select('id, name')
      .eq('name', customerName)
      .single();
    if (customerData) setCustomer(customerData);

    const { data: companyData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'company_info')
      .single();
    if (companyData) setCompanyInfo(companyData.value);

    setLoading(false);
  };

  const getProductInfo = (code: string) => {
    return products.find(p => p.code === code);
  };

  const customerItems = orderItems.filter(item => item.customer_name === customerName);

  const calculateTotal = () => {
    return customerItems.reduce((sum, item) => {
      const product = getProductInfo(item.product_code);
      if (!product || !product.wholesale_price_xcg_per_unit) return sum;
      const units = item.quantity * product.pack_size;
      return sum + (units * product.wholesale_price_xcg_per_unit);
    }, 0);
  };

  const containerClass = format === 'receipt' ? 'max-w-[80mm]' : 'max-w-[210mm]';
  const printClass = format === 'receipt' ? 'receipt-print-content format-receipt high-contrast-print' : 'receipt-print-content format-a4 high-contrast-print';
  const textSize = format === 'receipt' ? 'text-sm' : 'text-base';

  if (loading) {
    return (
      <div className={`${containerClass} mx-auto bg-white text-black p-6`}>
        <div className="text-center py-8 font-bold">Loading receipt data...</div>
      </div>
    );
  }

  return (
    <>
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
        }
      `}</style>
      <div className={`${containerClass} ${printClass} mx-auto bg-white text-black p-6 print:p-0 font-sans`}>
        {/* Company Header */}
        {companyInfo && (
          <div className="text-center mb-4 pb-4 border-b-2 border-black">
            {companyInfo.logo_url && (
              <img 
                src={companyInfo.logo_url} 
                alt="Company Logo" 
                className={`mx-auto mb-2 ${format === 'receipt' ? 'h-12' : 'h-16'} object-contain`}
              />
            )}
            <h2 className={`font-extrabold ${format === 'receipt' ? 'text-lg' : 'text-2xl'}`}>
              {companyInfo.company_name}
            </h2>
            <div className={`${textSize} text-black mt-1 font-medium`}>
              <p>{companyInfo.address_line1}</p>
              {companyInfo.address_line2 && <p>{companyInfo.address_line2}</p>}
              <p>{companyInfo.city}, {companyInfo.postal_code}</p>
              <p>Tel: {companyInfo.phone} | Email: {companyInfo.email}</p>
              {companyInfo.tax_info && <p className="text-sm mt-1 font-bold">{companyInfo.tax_info}</p>}
            </div>
          </div>
        )}

        <div className="border-b-4 border-black pb-4 mb-4">
          <h1 className={`${format === 'receipt' ? 'text-xl' : 'text-3xl'} font-extrabold text-center`}>RECEIPT</h1>
          <div className={`${textSize} mt-2 font-bold`}>
            <p><strong>Receipt #:</strong> {receiptNumber || `${order.order_number}-${customerName.replace(/\s+/g, '-').substring(0, 10)}`}</p>
            <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
            <p><strong>Order #:</strong> {order.order_number}</p>
          </div>
        </div>

        <div className="mb-4">
          <h2 className={`${format === 'receipt' ? 'text-lg' : 'text-xl'} font-extrabold mb-2`}>Bill To</h2>
          <p className={`${textSize} font-bold`}>{customerName}</p>
          {customerItems[0]?.po_number && (
            <p className={`${textSize} font-bold`}><strong>PO #:</strong> {customerItems[0].po_number}</p>
          )}
        </div>

        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="border-b-4 border-black">
              <th className={`${textSize} text-left py-2 font-extrabold`}>Item</th>
              <th className={`${textSize} text-right py-2 font-extrabold`}>Qty</th>
              <th className={`${textSize} text-right py-2 font-extrabold`}>Price</th>
              <th className={`${textSize} text-right py-2 font-extrabold`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {customerItems.map((item) => {
              const product = getProductInfo(item.product_code);
              const units = product ? item.quantity * product.pack_size : 0;
              const price = product?.wholesale_price_xcg_per_unit || 0;
              const lineTotal = units * price;
              
              return (
                <tr key={item.id} className="border-b-2 border-black">
                  <td className={`${textSize} py-2`}>
                    <div className="font-bold">{item.product_code}</div>
                    {product && <div className="text-black text-sm font-bold">{product.name}</div>}
                    <div className="text-black text-sm font-medium">{item.quantity} trays × {product?.pack_size} = {units} units</div>
                  </td>
                  <td className={`${textSize} text-right py-2 font-bold`}>{units}</td>
                  <td className={`${textSize} text-right py-2 font-bold`}>Cg {price.toFixed(2)}</td>
                  <td className={`${textSize} text-right py-2 font-bold`}>Cg {lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-4 border-black">
              <td colSpan={3} className={`${textSize} font-extrabold py-2 text-right`}>Total Amount Due:</td>
              <td className={`${textSize} font-extrabold text-right py-2`}>Cg {calculateTotal().toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div className={`${textSize} mt-6 pt-4 border-t-2 border-black`}>
          <p className="text-center font-extrabold mb-2">Payment Information</p>
          <p className="font-bold">Payment Method: _________________________</p>
          <p className="mt-2 font-bold">Signature: _________________________</p>
          <p className="mt-4 text-center text-sm font-bold">Thank you for your business!</p>
        </div>
      </div>
    </>
  );
};
