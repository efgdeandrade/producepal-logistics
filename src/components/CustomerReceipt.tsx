import { useState, useEffect, useCallback, useRef } from 'react';
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

interface CompanyInfo {
  company_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postal_code?: string;
  phone: string;
  email: string;
  tax_info?: string;
}

interface Props {
  order: Order;
  orderItems: OrderItem[];
  customerName: string;
  format: 'a4' | 'receipt';
  receiptNumber?: string;
  // Pre-loaded data to avoid async fetching during PDF generation
  preloadedProducts?: Product[];
  preloadedCompanyInfo?: CompanyInfo;
  onDataReady?: () => void;
}

const LOCAL_LOGO_PATH = '/images/fuik-logo.png';

export const CustomerReceipt = ({ 
  order, 
  orderItems, 
  customerName, 
  format, 
  receiptNumber,
  preloadedProducts,
  preloadedCompanyInfo,
  onDataReady
}: Props) => {
  const [products, setProducts] = useState<Product[]>(preloadedProducts || []);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(preloadedCompanyInfo || null);
  const [loading, setLoading] = useState(!preloadedProducts || !preloadedCompanyInfo);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const logoRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // If data is preloaded, skip fetching
    if (preloadedProducts && preloadedCompanyInfo) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [customerName, preloadedProducts, preloadedCompanyInfo]);

  // Notify parent when logo loads (important for PDF capture)
  useEffect(() => {
    if (!loading && logoLoaded) {
      onDataReady?.();
    }
  }, [loading, logoLoaded, onDataReady]);

  // Handle cached logo images (onLoad may not fire reliably in some capture flows)
  useEffect(() => {
    const img = logoRef.current;
    if (!img) return;
    if (img.complete && img.naturalHeight !== 0) {
      setLogoLoaded(true);
    }
  }, [loading]);

  const fetchData = async () => {
    setLoading(true);
    
    const [productsResult, customerResult, companyResult] = await Promise.all([
      supabase.from('products').select('code, name, pack_size, wholesale_price_xcg_per_unit'),
      supabase.from('customers').select('id, name').eq('name', customerName).single(),
      supabase.from('settings').select('value').eq('key', 'company_info').single()
    ]);
    
    if (productsResult.data) setProducts(productsResult.data);
    if (customerResult.data) setCustomer(customerResult.data);
    if (companyResult.data) setCompanyInfo(companyResult.data.value as unknown as CompanyInfo);

    setLoading(false);
  };

  const getProductInfo = useCallback((code: string) => {
    return products.find(p => p.code === code);
  }, [products]);

  const customerItems = orderItems.filter(item => item.customer_name === customerName);

  const calculateTotal = useCallback(() => {
    return customerItems.reduce((sum, item) => {
      const product = getProductInfo(item.product_code);
      if (!product || !product.wholesale_price_xcg_per_unit) return sum;
      const units = item.quantity * product.pack_size;
      return sum + (units * product.wholesale_price_xcg_per_unit);
    }, 0);
  }, [customerItems, getProductInfo]);

  const isReceipt = format === 'receipt';
  const containerClass = isReceipt ? 'max-w-[80mm]' : 'max-w-[210mm]';
  const printClass = isReceipt ? 'receipt-print-content format-receipt high-contrast-print' : 'receipt-print-content format-a4 high-contrast-print';

  if (loading) {
    return (
      <div className={`${containerClass} mx-auto bg-white text-black p-4`}>
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
      <div className={`${containerClass} ${printClass} mx-auto bg-white text-black ${isReceipt ? 'p-2' : 'p-6'} print:p-0 font-sans`}>
        {/* Company Header */}
        {companyInfo && (
          <div className={`text-center ${isReceipt ? 'mb-1 pb-1' : 'mb-4 pb-4'} border-b-2 border-black`}>
            <img 
              src={LOCAL_LOGO_PATH}
              alt="Company Logo" 
              ref={logoRef}
              onLoad={() => setLogoLoaded(true)}
              onError={() => setLogoLoaded(true)}
              className={`mx-auto ${isReceipt ? 'h-6 mb-0.5' : 'h-16 mb-1'} object-contain`}
            />
            <h2 className={`font-extrabold ${isReceipt ? 'text-sm leading-tight' : 'text-2xl'}`}>
              {companyInfo.company_name}
            </h2>
            {isReceipt ? (
              <div className="text-[10px] leading-tight">
                <p>{companyInfo.address_line1}, {companyInfo.city}</p>
                <p>{companyInfo.phone} • {companyInfo.email}</p>
              </div>
            ) : (
              <div className="text-base text-black mt-1 font-medium">
                <p>{companyInfo.address_line1}{companyInfo.address_line2 ? `, ${companyInfo.address_line2}` : ''}</p>
                <p>{companyInfo.city}, {companyInfo.postal_code}</p>
                <p>Tel: {companyInfo.phone} | {companyInfo.email}</p>
                {companyInfo.tax_info && <p className="text-xs mt-1 font-bold">{companyInfo.tax_info}</p>}
              </div>
            )}
          </div>
        )}

        {/* Receipt Title */}
        <div className={`border-b-2 border-black ${isReceipt ? 'pb-1 mb-1' : 'pb-4 mb-4'}`}>
          <h1 className={`${isReceipt ? 'text-base' : 'text-3xl'} font-extrabold text-center`}>RECEIPT</h1>
          <div className={`${isReceipt ? 'text-[10px]' : 'text-base'} font-bold leading-tight text-center`}>
            <p>#: {receiptNumber || `${order.order_number}-${customerName.replace(/\s+/g, '-').substring(0, 8)}`} | {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Customer Name */}
        <div className={isReceipt ? 'mb-1' : 'mb-4'}>
          <p className={`${isReceipt ? 'text-xs' : 'text-base'} font-extrabold`}>{customerName}</p>
          {customerItems[0]?.po_number && !isReceipt && (
            <p className="text-base font-bold"><strong>PO #:</strong> {customerItems[0].po_number}</p>
          )}
        </div>

        {/* Items Table - 3 columns for receipt, 4 for A4 */}
        <table className={`w-full border-collapse ${isReceipt ? 'mb-1' : 'mb-4'}`}>
          <thead>
            <tr className="border-b-2 border-black">
              <th className={`${isReceipt ? 'text-[10px]' : 'text-base'} text-left py-1 font-extrabold`}>Product</th>
              <th className={`${isReceipt ? 'text-[10px]' : 'text-base'} text-right py-1 font-extrabold`}>Qty</th>
              {!isReceipt && (
                <th className="text-base text-right py-1 font-extrabold border-l border-black pl-2">Price</th>
              )}
              <th className={`${isReceipt ? 'text-[10px]' : 'text-base'} text-right py-1 font-extrabold ${!isReceipt ? 'border-l border-black pl-2' : ''}`}>
                {isReceipt ? 'Amt' : 'Total'}
              </th>
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
                  <td className={`${isReceipt ? 'text-xs py-1' : 'text-base py-3'}`}>
                    <div className="font-bold leading-tight">{product?.name || item.product_code}</div>
                    {!isReceipt && <div className="text-xs font-medium">{item.quantity}×{product?.pack_size}</div>}
                  </td>
                  <td className={`${isReceipt ? 'text-xs py-1' : 'text-base py-3'} text-right font-bold`}>{units}</td>
                  {!isReceipt && (
                    <td className="text-base py-3 text-right font-bold border-l border-black pl-2">{price.toFixed(2)}</td>
                  )}
                  <td className={`${isReceipt ? 'text-xs py-1' : 'text-base py-3'} text-right font-bold ${!isReceipt ? 'border-l border-black pl-2' : ''}`}>
                    {lineTotal.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black">
              <td colSpan={isReceipt ? 2 : 3} className={`${isReceipt ? 'text-xs py-1' : 'text-base py-3'} font-extrabold text-right`}>Total:</td>
              <td className={`${isReceipt ? 'text-xs py-1' : 'text-base py-3'} font-extrabold text-right ${!isReceipt ? 'border-l border-black pl-2' : ''}`}>
                Cg {calculateTotal().toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Signature/Stamp Box */}
        <div className={`${isReceipt ? 'mt-1' : 'mt-4'}`}>
          <div 
            className={`border-2 border-black ${isReceipt ? 'h-16' : 'h-28'} w-full flex flex-col justify-between p-1`}
          >
            <p className={`${isReceipt ? 'text-[9px]' : 'text-sm'} font-bold text-center`}>
              SIGNATURE / STAMP
            </p>
            <div className="flex-1"></div>
            <div className="border-t border-dashed border-gray-400 pt-0.5">
              <p className={`${isReceipt ? 'text-[8px]' : 'text-xs'} text-gray-600 text-center`}>
                Received in good condition
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
