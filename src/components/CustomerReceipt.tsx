import { useState, useEffect, useCallback, useRef } from 'react';
import { format as formatDate } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  po_number?: string;
  sale_price_xcg?: number | null;
  stock_quantity?: number | null;
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
      const price = item.sale_price_xcg ?? product?.wholesale_price_xcg_per_unit ?? 0;
      if (!price) return sum;
      const totalQty = item.quantity + (item.stock_quantity ?? 0);
      const units = totalQty * (product?.pack_size || 1);
      return sum + (units * price);
    }, 0);
  }, [customerItems, getProductInfo]);

  const isReceipt = format === 'receipt';
  const containerClass = isReceipt ? 'w-[80mm]' : 'max-w-[210mm]';
  const printClass = isReceipt ? 'receipt-print-content format-receipt high-contrast-print' : 'receipt-print-content format-a4 high-contrast-print';

  if (loading) {
    return (
      <div className={`${containerClass} mx-auto bg-white text-black p-4`}>
        <div className="text-center py-8 font-bold">Loading receipt data...</div>
      </div>
    );
  }

  // For PDF capture: use fixed width that matches the expected output
  const fixedWidth = isReceipt ? '80mm' : '210mm';

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
      <div 
        className={`${printClass} bg-white text-black ${isReceipt ? 'py-3 px-0' : 'p-6'} print:p-0 font-sans box-border`}
        style={{ width: fixedWidth, margin: '0 auto' }}
      >
        {/* Company Header */}
        {companyInfo && (
          <div className={`text-center ${isReceipt ? 'mb-2 pb-2' : 'mb-4 pb-4'} border-b-2 border-black`}>
            <img 
              src={LOCAL_LOGO_PATH}
              alt="Company Logo" 
              ref={logoRef}
              onLoad={() => setLogoLoaded(true)}
              onError={() => setLogoLoaded(true)}
              className={`mx-auto ${isReceipt ? 'h-12 mb-1' : 'h-16 mb-1'} object-contain`}
            />
            <h2 className={`font-extrabold ${isReceipt ? 'text-xl leading-normal' : 'text-2xl'}`}>
              {companyInfo.company_name}
            </h2>
            {isReceipt ? (
              <div className="text-sm leading-relaxed mt-1">
                <p>{companyInfo.address_line1}, {companyInfo.city}</p>
                <p>{companyInfo.phone} • {companyInfo.email}</p>
              </div>
            ) : (
              <div className="text-base text-black mt-1 font-medium leading-relaxed">
                <p>{companyInfo.address_line1}{companyInfo.address_line2 ? `, ${companyInfo.address_line2}` : ''}</p>
                <p>{companyInfo.city}, {companyInfo.postal_code}</p>
                <p>Tel: {companyInfo.phone} | {companyInfo.email}</p>
                {companyInfo.tax_info && <p className="text-xs mt-1 font-bold">{companyInfo.tax_info}</p>}
              </div>
            )}
          </div>
        )}

        {/* Receipt Title */}
        <div className={`border-b-2 border-black ${isReceipt ? 'pb-2 mb-2' : 'pb-4 mb-4'}`}>
          <h1 className={`${isReceipt ? 'text-2xl' : 'text-3xl'} font-extrabold text-center`}>RECEIPT</h1>
          <div className={`${isReceipt ? 'text-sm mt-1' : 'text-base'} font-bold leading-normal text-center`}>
            <p>#: {receiptNumber || `${order.order_number}-${customerName.replace(/\s+/g, '-').substring(0, 8)}`} | {formatDate(new Date(), 'd MMM yyyy')}</p>
          </div>
        </div>

        {/* Customer Name */}
        <div className={isReceipt ? 'mb-2' : 'mb-4'}>
          <p className={`${isReceipt ? 'text-xl' : 'text-base'} font-extrabold`}>{customerName}</p>
          {customerItems[0]?.po_number && !isReceipt && (
            <p className="text-base font-bold"><strong>PO #:</strong> {customerItems[0].po_number}</p>
          )}
        </div>

        {/* Items Table - 4 columns for both formats */}
        <table
          className={`w-full border-collapse ${isReceipt ? 'mb-2 table-fixed' : 'mb-4'}`}
        >
          <thead>
            <tr className="border-b-2 border-black">
              <th
                className={`${isReceipt ? 'text-[10px]' : 'text-base'} text-left ${isReceipt ? 'py-2 pr-1' : 'py-2'} font-extrabold`}
                style={isReceipt ? { width: '48%' } : undefined}
              >
                Product
              </th>
              <th
                className={`${isReceipt ? 'text-[10px]' : 'text-base'} text-right ${isReceipt ? 'py-2 pr-1' : 'py-2'} font-extrabold`}
                style={isReceipt ? { width: '14%' } : undefined}
              >
                Qty
              </th>
              <th
                className={`${isReceipt ? 'text-[10px]' : 'text-base'} text-right ${isReceipt ? 'py-2 pr-1' : 'py-2'} font-extrabold ${!isReceipt ? 'border-l border-black pl-2' : ''}`}
                style={isReceipt ? { width: '18%' } : undefined}
              >
                Price
              </th>
              <th
                className={`${isReceipt ? 'text-[10px]' : 'text-base'} text-right ${isReceipt ? 'py-2' : 'py-2'} font-extrabold ${!isReceipt ? 'border-l border-black pl-2' : ''}`}
                style={isReceipt ? { width: '20%' } : undefined}
              >
                {isReceipt ? 'Amt' : 'Total'}
              </th>
            </tr>
          </thead>
          <tbody>
            {customerItems.map((item) => {
              const product = getProductInfo(item.product_code);
              const totalQty = item.quantity + (item.stock_quantity ?? 0);
              const units = product ? totalQty * product.pack_size : totalQty;
              const price = item.sale_price_xcg ?? product?.wholesale_price_xcg_per_unit ?? 0;
              const lineTotal = units * price;

              return (
                <tr key={item.id} className="border-b border-black">
                  <td className={`${isReceipt ? 'text-sm py-2 pr-1' : 'text-base py-3'}`}>
                    <div className="font-bold leading-normal break-words">
                      {product?.name || item.product_code}
                    </div>
                    {!isReceipt && (
                      <div className="text-xs font-medium mt-0.5">
                        {totalQty}×{product?.pack_size}
                      </div>
                    )}
                  </td>
                  <td
                    className={`${isReceipt ? 'text-sm py-2 pr-1' : 'text-base py-3'} text-right font-bold whitespace-nowrap`}
                  >
                    {units}
                  </td>
                  <td
                    className={`${isReceipt ? 'text-sm py-2 pr-1' : 'text-base py-3'} text-right font-bold whitespace-nowrap ${!isReceipt ? 'border-l border-black pl-2' : ''}`}
                  >
                    {price.toFixed(2)}
                  </td>
                  <td
                    className={`${isReceipt ? 'text-sm py-2' : 'text-base py-3'} text-right font-bold whitespace-nowrap ${!isReceipt ? 'border-l border-black pl-2' : ''}`}
                  >
                    {lineTotal.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black">
              <td
                colSpan={3}
                className={`${isReceipt ? 'text-sm py-2 pr-1' : 'text-base py-3'} font-extrabold text-right whitespace-nowrap`}
              >
                Total:
              </td>
              <td
                className={`${isReceipt ? 'text-sm py-2' : 'text-base py-3'} font-extrabold text-right whitespace-nowrap ${!isReceipt ? 'border-l border-black pl-2' : ''}`}
              >
                Cg {calculateTotal().toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Signature/Stamp Box */}
        <div className={`${isReceipt ? 'mt-3' : 'mt-4'}`}>
          <div 
            className={`border-2 border-black ${isReceipt ? 'h-36' : 'h-28'} w-full flex flex-col justify-between p-2`}
          >
            <p className={`${isReceipt ? 'text-xs' : 'text-sm'} font-bold text-center`}>
              SIGNATURE / STAMP
            </p>
            <div className="flex-1"></div>
            <div className="border-t border-dashed border-gray-400 pt-1">
              <p className={`${isReceipt ? 'text-[10px]' : 'text-xs'} text-gray-600 text-center`}>
                Received in good condition
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
