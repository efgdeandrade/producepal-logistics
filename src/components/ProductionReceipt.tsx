import { format } from 'date-fns';

interface ProductionItem {
  id: string;
  customer_name: string;
  product_code: string;
  product_name: string;
  predicted_quantity: number;
  actual_quantity: number | null;
  notes: string | null;
}

interface ProductionReceiptProps {
  customerName: string;
  deliveryDate: string;
  items: ProductionItem[];
}

const ProductionReceipt = ({ customerName, deliveryDate, items }: ProductionReceiptProps) => {
  // Group items by category based on product name patterns
  const groupedItems: { [category: string]: ProductionItem[] } = {
    'HERBS PACKS': [],
    'HERBS BOX': [],
    'MICROGREENS': [],
    'SPROUTS': []
  };

  items.forEach(item => {
    if (item.product_code.startsWith('HERBS_PACKS_')) {
      groupedItems['HERBS PACKS'].push(item);
    } else if (item.product_code.startsWith('HERBS_BOX_')) {
      groupedItems['HERBS BOX'].push(item);
    } else if (item.product_code.startsWith('MICROGREENS_')) {
      groupedItems['MICROGREENS'].push(item);
    } else if (item.product_code.startsWith('SPROUTS_')) {
      groupedItems['SPROUTS'].push(item);
    }
  });

  // Filter out empty categories and items with zero quantity
  const activeCategories = Object.entries(groupedItems).filter(([_, items]) => 
    items.some(item => (item.actual_quantity || 0) > 0)
  );

  const totalItems = items.reduce((sum, item) => sum + (item.actual_quantity || 0), 0);

  return (
    <div className="receipt-page bg-white text-black p-4">
      <style>{`
        @media print {
          .receipt-page {
            page-break-after: always;
            width: 80mm;
            max-width: 80mm;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
        .receipt-page {
          width: 80mm;
          max-width: 80mm;
          font-family: 'Courier New', monospace;
        }
      `}</style>
      
      {/* Header */}
      <div className="border-b-2 border-black pb-2 mb-3 text-center">
        <h1 className="text-lg font-bold mb-1">PRODUCTION RECEIPT</h1>
        <div className="text-xs">
          <p>{format(new Date(deliveryDate), 'MMM d, yyyy')}</p>
          <p>{format(new Date(), 'MMM d, yyyy HH:mm')}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-3 pb-2 border-b border-dashed border-gray-400">
        <p className="text-xs font-semibold">CUSTOMER:</p>
        <p className="font-bold text-sm">{customerName}</p>
      </div>

      {/* Items by Category */}
      <div className="mb-3">
        {activeCategories.map(([category, categoryItems]) => (
          <div key={category} className="mb-3">
            <p className="text-xs font-bold border-b border-gray-400 pb-1 mb-2">{category}</p>
            <table className="w-full text-xs mb-2">
              <thead>
                <tr className="border-b border-gray-400">
                  <th className="text-left py-1">Product</th>
                  <th className="text-center py-1 w-12">Tgt</th>
                  <th className="text-center py-1 w-12">Qty</th>
                </tr>
              </thead>
              <tbody>
                {categoryItems
                  .filter(item => (item.actual_quantity || 0) > 0)
                  .map((item) => (
                    <tr key={item.id} className="border-b border-dotted border-gray-300">
                      <td className="py-1 text-xs">{item.product_name}</td>
                      <td className="py-1 text-center text-xs">
                        {item.predicted_quantity}
                      </td>
                      <td className="py-1 text-center font-bold">
                        {item.actual_quantity || 0}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t-2 border-black pt-2 mb-3">
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL ITEMS:</span>
          <span>{totalItems}</span>
        </div>
      </div>

      {/* Signature Section */}
      <div className="border-t border-dashed border-gray-400 pt-3 mt-4 text-xs">
        <div className="mb-3">
          <p className="mb-1 font-semibold">Delivered By:</p>
          <div className="border-b border-black pt-6"></div>
        </div>
        <div className="mb-3">
          <p className="mb-1 font-semibold">Received By:</p>
          <div className="border-b border-black pt-6"></div>
        </div>
        <div className="mb-3">
          <p className="mb-1 font-semibold">Date & Time:</p>
          <div className="border-b border-black pt-6"></div>
        </div>
      </div>
      
      <div className="text-center text-xs mt-4 border-t border-gray-400 pt-2">
        <p>Thank you!</p>
      </div>
    </div>
  );
};

export default ProductionReceipt;
