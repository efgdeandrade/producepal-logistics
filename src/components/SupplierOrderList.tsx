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
  consolidation_group?: string | null;
}

interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
}

interface ConsolidatedGroup {
  groupName: string;
  packSize: number;
  products: Array<{ code: string; name: string; units: number }>;
  totalUnits: number;
  totalCases: number;
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
      .select('code, name, pack_size, supplier_id, consolidation_group');
    
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

  // Calculate consolidated groups for a set of items
  const getConsolidatedGroups = (items: OrderItem[]): { 
    consolidated: ConsolidatedGroup[]; 
    individual: Array<{ code: string; name: string; quantity: number; units: number }> 
  } => {
    const groupMap = new Map<string, ConsolidatedGroup>();
    const individual: Array<{ code: string; name: string; quantity: number; units: number }> = [];

    // STEP 1: First aggregate quantities by product code
    const productTotals = items.reduce((acc, item) => {
      if (!acc[item.product_code]) {
        acc[item.product_code] = 0;
      }
      acc[item.product_code] += item.quantity;
      return acc;
    }, {} as Record<string, number>);

    // STEP 2: Process aggregated totals
    Object.entries(productTotals).forEach(([productCode, quantity]) => {
      const product = getProductInfo(productCode);
      if (!product) return;

      const units = quantity * product.pack_size;

      if (product.consolidation_group) {
        const groupKey = `${product.consolidation_group}-${product.pack_size}`;
        
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            groupName: product.consolidation_group,
            packSize: product.pack_size,
            products: [],
            totalUnits: 0,
            totalCases: 0
          });
        }
        
        const group = groupMap.get(groupKey)!;
        group.products.push({ code: product.code, name: product.name, units });
        group.totalUnits += units;
        group.totalCases = Math.ceil(group.totalUnits / group.packSize);
      } else {
        individual.push({
          code: product.code,
          name: product.name,
          quantity,
          units
        });
      }
    });

    return {
      consolidated: Array.from(groupMap.values()),
      individual
    };
  };

  const containerClass = format === 'receipt' ? 'max-w-[80mm]' : 'max-w-[210mm]';
  const textSize = format === 'receipt' ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-8">
      {Object.entries(groupedBySupplier).map(([supplierName, { supplier, items }]) => {
        const { consolidated, individual } = getConsolidatedGroups(items);
        
        // Calculate grand totals
        const totalConsolidatedCases = consolidated.reduce((sum, g) => sum + g.totalCases, 0);
        const totalIndividualTrays = individual.reduce((sum, p) => sum + p.quantity, 0);
        const totalUnits = consolidated.reduce((sum, g) => sum + g.totalUnits, 0) + 
                          individual.reduce((sum, p) => sum + p.units, 0);

        return (
          <div key={supplierName} data-supplier={supplierName} className={`${containerClass} mx-auto bg-white text-black p-6 supplier-page`}>
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
                  <th className={`${textSize} text-right py-2`}>Cases/Trays</th>
                  <th className={`${textSize} text-right py-2`}>Units</th>
                </tr>
              </thead>
              <tbody>
                {/* Consolidated Groups */}
                {consolidated.map((group) => (
                  <tr key={group.groupName} className="border-b border-gray-300 bg-green-50">
                    <td className={`${textSize} py-2`} colSpan={3}>
                      <div className="font-bold text-green-800">
                        {group.groupName} ({group.packSize}/case) — {group.totalCases} CASES
                      </div>
                      <div className="pl-4 mt-1 space-y-0.5">
                        {group.products.map(p => (
                          <div key={p.code} className="text-gray-600 flex justify-between">
                            <span>↳ {p.name}</span>
                            <span>{p.units} units</span>
                          </div>
                        ))}
                      </div>
                      <div className="pl-4 mt-1 text-gray-800 font-medium border-t border-green-200 pt-1">
                        Total: {group.totalUnits} units → {group.totalCases} cases
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Individual Products (no consolidation group) */}
                {individual.map((product) => (
                  <tr key={product.code} className="border-b border-gray-300">
                    <td className={`${textSize} py-2`}>
                      <div>{product.code}</div>
                      <div className="text-gray-600">{product.name}</div>
                    </td>
                    <td className={`${textSize} text-right py-2`}>{product.quantity}</td>
                    <td className={`${textSize} text-right py-2`}>{product.units}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black">
                  <td className={`${textSize} font-bold py-2`}>Grand Total</td>
                  <td className={`${textSize} font-bold text-right py-2`}>
                    {totalConsolidatedCases > 0 && `${totalConsolidatedCases} cases`}
                    {totalConsolidatedCases > 0 && totalIndividualTrays > 0 && ' + '}
                    {totalIndividualTrays > 0 && `${totalIndividualTrays} trays`}
                  </td>
                  <td className={`${textSize} font-bold text-right py-2`}>
                    {totalUnits}
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
          .supplier-page {
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .supplier-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
        @media screen {
          .supplier-page + .supplier-page {
            margin-top: 2rem;
            border-top: 2px dashed #ccc;
            padding-top: 2rem;
          }
        }
      `}</style>
    </div>
  );
};
