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

const LOCAL_LOGO_PATH = '/images/fuik-logo.png';

export const CustomerReceipt = ({ order, orderItems, customerName, format, receiptNumber }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logoLoaded, setLogoLoaded] = useState(false);

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
      <div className={`${containerClass} ${printClass} mx-auto bg-white text-black ${format === 'receipt' ? 'p-3' : 'p-6'} print:p-0 font-sans`}>
        {/* Company Header - Ultra Compact for Receipt */}
        {companyInfo && (
          <div className={`text-center ${format === 'receipt' ? 'mb-2 pb-1' : 'mb-4 pb-4'} border-b-2 border-black`}>
            <img 
              src={LOCAL_LOGO_PATH}
              alt="Company Logo" 
              onLoad={() => setLogoLoaded(true)}
              className={`mx-auto ${format === 'receipt' ? 'h-8 mb-1' : 'h-16 mb-1'} object-contain`}
            />
            <h2 className={`font-extrabold ${format === 'receipt' ? 'text-base leading-tight' : 'text-2xl'}`}>
              {companyInfo.company_name}
            </h2>
            {format !== 'receipt' && (
              <div className={`${textSize} text-black mt-1 font-medium`}>
                <p>{companyInfo.address_line1}{companyInfo.address_line2 ? `, ${companyInfo.address_line2}` : ''}</p>
                <p>{companyInfo.city}, {companyInfo.postal_code}</p>
                <p>Tel: {companyInfo.phone} | {companyInfo.email}</p>
                {companyInfo.tax_info && <p className="text-xs mt-1 font-bold">{companyInfo.tax_info}</p>}
              </div>
            )}
            {format === 'receipt' && (
              <div className="text-xs leading-tight">
                <p>{companyInfo.address_line1}, {companyInfo.city}</p>
                <p>Tel: {companyInfo.phone} | {companyInfo.email}</p>
              </div>
            )}
          </div>
        )}

        <div className={`border-b-2 border-black ${format === 'receipt' ? 'pb-1 mb-2' : 'pb-4 mb-4'}`}>
          <h1 className={`${format === 'receipt' ? 'text-lg' : 'text-3xl'} font-extrabold text-center`}>RECEIPT</h1>
          <div className={`${format === 'receipt' ? 'text-xs' : textSize} font-bold leading-tight`}>
            <p>#: {receiptNumber || `${order.order_number}-${customerName.replace(/\s+/g, '-').substring(0, 8)}`} | {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className={format === 'receipt' ? 'mb-1' : 'mb-4'}>
          <p className={`${format === 'receipt' ? 'text-sm' : textSize} font-extrabold`}>{customerName}</p>
          {customerItems[0]?.po_number && format !== 'receipt' && (
            <p className={`${textSize} font-bold`}><strong>PO #:</strong> {customerItems[0].po_number}</p>
          )}
        </div>

        <table className={`w-full border-collapse ${format === 'receipt' ? 'mb-1' : 'mb-4'}`}>
          <thead>
            <tr className="border-b-2 border-black">
              <th className={`${format === 'receipt' ? 'text-xs' : textSize} text-left py-1 font-extrabold`}>Item</th>
              <th className={`${format === 'receipt' ? 'text-xs' : textSize} text-right py-1 font-extrabold border-l border-black pl-2`}>Qty</th>
              <th className={`${format === 'receipt' ? 'text-xs' : textSize} text-right py-1 font-extrabold border-l border-black pl-2`}>Price</th>
              <th className={`${format === 'receipt' ? 'text-xs' : textSize} text-right py-1 font-extrabold border-l border-black pl-2`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {customerItems.map((item) => {
              const product = getProductInfo(item.product_code);
              const units = product ? item.quantity * product.pack_size : 0;
              const price = product?.wholesale_price_xcg_per_unit || 0;
              const lineTotal = units * price;
              
              return (
                <tr key={item.id} className="border-b border-black">
                  <td className={`${format === 'receipt' ? 'text-sm py-3' : `${textSize} py-3`}`}>
                    {product && <div className="font-bold leading-tight">{product.name}</div>}
                    {format !== 'receipt' && <div className="text-xs font-medium">{item.quantity}×{product?.pack_size}</div>}
                  </td>
                  <td className={`${format === 'receipt' ? 'text-sm py-3' : `${textSize} py-3`} text-right font-bold border-l border-black pl-2`}>{units}</td>
                  <td className={`${format === 'receipt' ? 'text-sm py-3' : `${textSize} py-3`} text-right font-bold border-l border-black pl-2`}>{price.toFixed(2)}</td>
                  <td className={`${format === 'receipt' ? 'text-sm py-3' : `${textSize} py-3`} text-right font-bold border-l border-black pl-2`}>{lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black">
              <td colSpan={3} className={`${format === 'receipt' ? 'text-xs py-3' : `${textSize} py-3`} font-extrabold text-right`}>Total:</td>
              <td className={`${format === 'receipt' ? 'text-sm py-3' : `${textSize} py-3`} font-extrabold text-right border-l border-black pl-2`}>Cg {calculateTotal().toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div className={`${format === 'receipt' ? 'mt-1 pt-1 text-xs' : 'mt-4 pt-2'} border-t border-black`}>
          <p className="font-bold">Sig: _______________</p>
        </div>
      </div>
    </>
  );
};
