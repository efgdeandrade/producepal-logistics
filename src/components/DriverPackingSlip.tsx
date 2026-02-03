import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCuracao } from '@/lib/dateUtils';

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

interface DistributionOrderItem {
  customer_id: string;
  customer_name: string;
  product_code: string;
  product_name: string;
  quantity: number;
  distribution_product_id: string;
}

interface DriverAssignment {
  driver_name: string;
  customer_names: string[];
  distribution_customer_ids?: string[];
  sequence_number: number;
  include_distribution?: boolean;
}

interface Props {
  order: Order;
  orderItems: OrderItem[];
  driverAssignments: DriverAssignment[];
  format: 'a4' | 'receipt';
  distributionOrderItems?: DistributionOrderItem[];
}

interface Product {
  code: string;
  name: string;
  pack_size: number;
}

interface ProductMapping {
  import_product_code: string;
  distribution_product_id: string;
  conversion_factor: number;
}

interface DistributionCustomerInfo {
  id: string;
  name: string;
}

export const DriverPackingSlip = ({ 
  order, 
  orderItems, 
  driverAssignments, 
  format,
  distributionOrderItems = []
}: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productMappings, setProductMappings] = useState<ProductMapping[]>([]);
  const [distributionCustomers, setDistributionCustomers] = useState<DistributionCustomerInfo[]>([]);

  useEffect(() => {
    fetchProducts();
    fetchProductMappings();
    if (distributionOrderItems.length > 0) {
      fetchDistributionCustomers();
    }
  }, [distributionOrderItems]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('code, name, pack_size');
    if (data) setProducts(data);
  };

  const fetchProductMappings = async () => {
    const { data } = await supabase
      .from('cross_department_product_mappings')
      .select('import_product_code, distribution_product_id, conversion_factor');
    if (data) setProductMappings(data);
  };

  const fetchDistributionCustomers = async () => {
    const customerIds = [...new Set(distributionOrderItems.map(item => item.customer_id))];
    if (customerIds.length === 0) return;
    
    const { data } = await supabase
      .from('distribution_customers')
      .select('id, name')
      .in('id', customerIds);
    if (data) setDistributionCustomers(data);
  };

  const getProductInfo = (code: string) => {
    return products.find(p => p.code === code);
  };

  const getDistributionCustomerName = (id: string) => {
    return distributionCustomers.find(c => c.id === id)?.name || 'Unknown';
  };

  const getAggregatedProducts = (
    importCustomerNames: string[], 
    distributionCustomerIds: string[] = []
  ) => {
    const totals: Record<string, { code: string; name: string; cases: number; units: number }> = {};
    
    // Add Import order items
    orderItems
      .filter(item => importCustomerNames.includes(item.customer_name))
      .forEach(item => {
        const product = getProductInfo(item.product_code);
        const packSize = product?.pack_size || 1;
        
        if (!totals[item.product_code]) {
          totals[item.product_code] = {
            code: item.product_code,
            name: product?.name || item.product_code,
            cases: 0,
            units: 0
          };
        }
        totals[item.product_code].cases += item.quantity;
        totals[item.product_code].units += item.quantity * packSize;
      });
    
    // Add Distribution order items (converted to Import equivalents)
    distributionOrderItems
      .filter(item => distributionCustomerIds.includes(item.customer_id))
      .forEach(item => {
        // Find mapping for this distribution product
        const mapping = productMappings.find(
          m => m.distribution_product_id === item.distribution_product_id
        );
        
        if (mapping) {
          const importCode = mapping.import_product_code;
          const importProduct = getProductInfo(importCode);
          const packSize = importProduct?.pack_size || 1;
          const convertedQty = item.quantity * (mapping.conversion_factor || 1);
          
          if (!totals[importCode]) {
            totals[importCode] = {
              code: importCode,
              name: importProduct?.name || importCode,
              cases: 0,
              units: 0
            };
          }
          totals[importCode].cases += convertedQty;
          totals[importCode].units += convertedQty * packSize;
        }
      });
    
    return Object.values(totals).sort((a, b) => a.name.localeCompare(b.name));
  };

  const containerClass = format === 'receipt' ? 'max-w-[80mm]' : 'max-w-[210mm]';
  const textSize = format === 'receipt' ? 'text-sm' : 'text-base';

  const hasDistribution = driverAssignments.some(
    a => a.include_distribution && (a.distribution_customer_ids?.length || 0) > 0
  );

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
      
      {driverAssignments.map((assignment, index) => {
        const distCustomerIds = assignment.distribution_customer_ids || [];
        const aggregatedProducts = getAggregatedProducts(
          assignment.customer_names, 
          distCustomerIds
        );
        const totalCases = aggregatedProducts.reduce((sum, p) => sum + p.cases, 0);
        const totalUnits = aggregatedProducts.reduce((sum, p) => sum + p.units, 0);
        const totalStops = assignment.customer_names.length + distCustomerIds.length;

        return (
          <div 
            key={index}
            data-driver={assignment.driver_name}
            className={`${containerClass} mx-auto bg-white text-black p-6 page-break high-contrast-print font-sans`}
          >
            {/* Header */}
            <div className="border-b-4 border-black pb-4 mb-4">
              <h1 className={`${format === 'receipt' ? 'text-xl' : 'text-3xl'} font-extrabold`}>
                DRIVER PACKING SLIP
              </h1>
              <div className={`${textSize} mt-2 font-bold`}>
                <p><strong>Order #:</strong> {order.order_number}</p>
                <p><strong>Week:</strong> {order.week_number}</p>
                <p><strong>Delivery Date:</strong> {formatCuracao(order.delivery_date, 'PPP')}</p>
              </div>
            </div>

            {/* Driver Info */}
            <div className="mb-4 p-3 bg-gray-100 rounded">
              <h2 className={`${format === 'receipt' ? 'text-lg' : 'text-2xl'} font-extrabold mb-1`}>
                Driver: {assignment.driver_name}
              </h2>
              <p className={`${textSize} font-bold`}>
                Route #{assignment.sequence_number + 1} • {totalStops} Stop{totalStops !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Import Customer List */}
            {assignment.customer_names.length > 0 && (
              <div className="mb-4">
                <h3 className={`${format === 'receipt' ? 'text-base' : 'text-lg'} font-bold mb-2`}>
                  {hasDistribution ? '📦 Import Customers (Supermarkets):' : 'Delivery Stops:'}
                </h3>
                <ol className={`${textSize} list-decimal list-inside space-y-1`}>
                  {assignment.customer_names.map((customer, idx) => (
                    <li key={idx} className="font-bold">{customer}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Distribution Customer List */}
            {distCustomerIds.length > 0 && (
              <div className="mb-4">
                <h3 className={`${format === 'receipt' ? 'text-base' : 'text-lg'} font-bold mb-2`}>
                  🍽️ Distribution Customers (Restaurants/Hotels):
                </h3>
                <ol 
                  className={`${textSize} list-decimal list-inside space-y-1`}
                  start={assignment.customer_names.length + 1}
                >
                  {distCustomerIds.map((customerId, idx) => (
                    <li key={idx} className="font-bold">
                      {getDistributionCustomerName(customerId)}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Aggregated Products Table */}
            <div className="mb-4">
              <h3 className={`${format === 'receipt' ? 'text-base' : 'text-lg'} font-bold mb-2`}>
                Products to Load:
              </h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-4 border-black">
                    <th className={`${textSize} text-left py-2 font-extrabold`}>Product</th>
                    <th className={`${textSize} text-right py-2 font-extrabold`}>Cases</th>
                    <th className={`${textSize} text-right py-2 font-extrabold`}>Units</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedProducts.map((product) => (
                    <tr key={product.code} className="border-b-2 border-black">
                      <td className={`${textSize} py-2`}>
                        <div className="font-bold">{product.code}</div>
                        <div className="text-black font-bold">{product.name}</div>
                      </td>
                      <td className={`${textSize} text-right py-2 font-bold`}>{product.cases}</td>
                      <td className={`${textSize} text-right py-2 font-bold`}>{product.units}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-4 border-black">
                    <td className={`${textSize} font-extrabold py-2`}>TOTAL</td>
                    <td className={`${textSize} font-extrabold text-right py-2`}>{totalCases}</td>
                    <td className={`${textSize} font-extrabold text-right py-2`}>{totalUnits}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Summary Box */}
            <div className="p-3 border-4 border-black text-center mb-4">
              <p className={`${format === 'receipt' ? 'text-lg' : 'text-xl'} font-extrabold`}>
                {totalCases} CASES = {totalUnits} UNITS
              </p>
            </div>

            {/* Signature Section */}
            <div className={`${textSize} mt-6 pt-4 border-t-2 border-black`}>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="font-bold">Driver Signature: _________________________</p>
                  <p className="mt-2 font-bold">Date: {new Date().toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="font-bold">Checked By: _________________________</p>
                  <p className="mt-2 font-bold">Time: _______________</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
