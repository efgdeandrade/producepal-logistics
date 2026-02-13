import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCuracao } from '@/lib/dateUtils';

interface OrderItem {
  id: string;
  customer_name: string;
  product_code: string;
  quantity: number;
  is_from_stock?: boolean;
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
  supplier_id?: string;
  consolidation_group?: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface ConsolidatedGroup {
  groupName: string;
  packSize: number;
  supplierName: string;
  products: Array<{ code: string; name: string; units: number }>;
  totalUnits: number;
  totalCases: number;
}

export const RoundupTable = ({ order, orderItems, format }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data: productsData } = await supabase
      .from('products')
      .select('code, name, pack_size, supplier_id, consolidation_group');
    
    const { data: suppliersData } = await supabase
      .from('suppliers')
      .select('id, name');
    
    if (productsData) setProducts(productsData);
    if (suppliersData) setSuppliers(suppliersData);
  };

  const getProductInfo = (code: string) => {
    return products.find(p => p.code === code);
  };

  const getSupplierName = (supplierId?: string) => {
    if (!supplierId) return 'Unassigned';
    return suppliers.find(s => s.id === supplierId)?.name || 'Unknown';
  };

  // Build consolidated groups and individual products
  const buildConsolidatedData = () => {
    const groupMap = new Map<string, ConsolidatedGroup>();
    const individualProducts: Array<{ 
      code: string; 
      name: string; 
      supplierName: string;
      quantity: number; 
      units: number 
    }> = [];

    // First aggregate quantities per product
    const productTotals = orderItems.reduce((acc, item) => {
      const netQuantity = Math.max(0, item.quantity - (item.stock_quantity || 0));
      if (netQuantity === 0) return acc;
      
      if (!acc[item.product_code]) {
        acc[item.product_code] = 0;
      }
      acc[item.product_code] += netQuantity;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(productTotals).forEach(([productCode, quantity]) => {
      const product = getProductInfo(productCode);
      if (!product) return;

      const units = quantity * product.pack_size;
      const supplierName = getSupplierName(product.supplier_id);

      if (product.consolidation_group) {
        // Key by supplier + group + pack_size to ensure proper grouping
        const groupKey = `${product.supplier_id || 'none'}-${product.consolidation_group}-${product.pack_size}`;
        
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            groupName: product.consolidation_group,
            packSize: product.pack_size,
            supplierName,
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
        individualProducts.push({
          code: product.code,
          name: product.name,
          supplierName,
          quantity,
          units
        });
      }
    });

    return {
      consolidated: Array.from(groupMap.values()),
      individual: individualProducts
    };
  };

  const { consolidated, individual } = buildConsolidatedData();
  
  // Grand totals
  const totalConsolidatedCases = consolidated.reduce((sum, g) => sum + g.totalCases, 0);
  const totalIndividualTrays = individual.reduce((sum, p) => sum + p.quantity, 0);
  const totalUnits = consolidated.reduce((sum, g) => sum + g.totalUnits, 0) + 
                    individual.reduce((sum, p) => sum + p.units, 0);

  const containerClass = format === 'receipt' ? 'max-w-[80mm]' : 'max-w-[210mm]';
  const textSize = format === 'receipt' ? 'text-xs' : 'text-sm';

  return (
    <div className={`${containerClass} mx-auto bg-white text-black p-6`}>
      <div className="border-b-2 border-black pb-4 mb-4">
        <h1 className={`${format === 'receipt' ? 'text-lg' : 'text-2xl'} font-bold`}>ORDER ROUNDUP</h1>
        <div className={`${textSize} mt-2`}>
          <p><strong>Order #:</strong> {order.order_number}</p>
          <p><strong>Week:</strong> {order.week_number}</p>
          <p><strong>Delivery Date:</strong> {formatCuracao(order.delivery_date, 'PPP')}</p>
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
            <th className={`${textSize} text-left py-2`}>Product / Group</th>
            <th className={`${textSize} text-right py-2`}>Cases/Trays</th>
            <th className={`${textSize} text-right py-2`}>Units</th>
            <th className={`${textSize} text-center py-2`}>✓</th>
          </tr>
        </thead>
        <tbody>
          {/* Consolidated Groups */}
          {consolidated.map((group) => (
            <tr key={`${group.supplierName}-${group.groupName}`} className="border-b border-gray-300 bg-green-50">
              <td className={`${textSize} py-3`} colSpan={4}>
                <div className="font-bold text-green-800 flex justify-between items-center">
                  <span>{group.groupName} ({group.packSize}/case)</span>
                  <span className="text-lg">{group.totalCases} CASES</span>
                  <div className="w-6 h-6 border-2 border-black"></div>
                </div>
                <div className="text-xs text-gray-500 mb-1">{group.supplierName}</div>
                <div className="pl-4 mt-1 space-y-0.5">
                  {group.products.map(p => (
                    <div key={p.code} className="text-gray-600 flex justify-between pr-8">
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

          {/* Individual Products */}
          {individual.map((product) => (
            <tr key={product.code} className="border-b border-gray-300">
              <td className={`${textSize} py-3`}>
                <div className="font-semibold">{product.code}</div>
                <div className="text-gray-600">{product.name}</div>
                <div className="text-xs text-gray-500">{product.supplierName}</div>
              </td>
              <td className={`${textSize} text-right py-3 font-semibold`}>{product.quantity}</td>
              <td className={`${textSize} text-right py-3`}>{product.units}</td>
              <td className={`${textSize} text-center py-3`}>
                <div className="w-6 h-6 border-2 border-black mx-auto"></div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black">
            <td className={`${textSize} font-bold py-3`}>Grand Total</td>
            <td className={`${textSize} font-bold text-right py-3`}>
              {totalConsolidatedCases > 0 && `${totalConsolidatedCases} cases`}
              {totalConsolidatedCases > 0 && totalIndividualTrays > 0 && ' + '}
              {totalIndividualTrays > 0 && `${totalIndividualTrays} trays`}
            </td>
            <td className={`${textSize} font-bold text-right py-3`}>
              {totalUnits}
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
