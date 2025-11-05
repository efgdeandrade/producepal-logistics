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
    <div className="receipt-page bg-white text-black p-8 min-h-screen">
      <style>{`
        @media print {
          .receipt-page {
            page-break-after: always;
          }
          @page {
            size: A4;
            margin: 1cm;
          }
        }
      `}</style>
      
      {/* Header */}
      <div className="border-b-2 border-black pb-6 mb-6">
        <h1 className="text-3xl font-bold mb-2">PRODUCTION RECEIPT</h1>
        <div className="text-lg">
          <p><strong>Delivery Date:</strong> {format(new Date(deliveryDate), 'MMMM d, yyyy')}</p>
          <p><strong>Printed:</strong> {format(new Date(), 'MMMM d, yyyy HH:mm')}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-8 p-4 bg-gray-100 border border-gray-300">
        <h2 className="text-2xl font-bold mb-2">Customer</h2>
        <p className="text-xl">{customerName}</p>
      </div>

      {/* Items by Category */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 border-b border-gray-400 pb-2">Products</h2>
        
        {activeCategories.map(([category, categoryItems]) => (
          <div key={category} className="mb-6">
            <h3 className="text-lg font-bold mb-3 text-gray-700">{category}</h3>
            <table className="w-full border-collapse mb-4">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-gray-400 px-4 py-2 text-left">Product</th>
                  <th className="border border-gray-400 px-4 py-2 text-center w-32">Target Qty</th>
                  <th className="border border-gray-400 px-4 py-2 text-center w-32">Actual Qty</th>
                </tr>
              </thead>
              <tbody>
                {categoryItems
                  .filter(item => (item.actual_quantity || 0) > 0)
                  .map((item) => (
                    <tr key={item.id}>
                      <td className="border border-gray-400 px-4 py-2">{item.product_name}</td>
                      <td className="border border-gray-400 px-4 py-2 text-center font-semibold">
                        {item.predicted_quantity}
                      </td>
                      <td className="border border-gray-400 px-4 py-2 text-center font-bold text-lg">
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
      <div className="border-t-2 border-black pt-4 mb-8">
        <div className="flex justify-between text-xl font-bold">
          <span>Total Items:</span>
          <span>{totalItems}</span>
        </div>
      </div>

      {/* Signature Section */}
      <div className="border-t border-gray-400 pt-8 mt-16">
        <div className="grid grid-cols-2 gap-12">
          <div>
            <p className="mb-2 font-semibold">Delivered By:</p>
            <div className="border-b border-black pt-12"></div>
            <p className="text-sm text-gray-600 mt-1">Signature</p>
          </div>
          <div>
            <p className="mb-2 font-semibold">Received By:</p>
            <div className="border-b border-black pt-12"></div>
            <p className="text-sm text-gray-600 mt-1">Signature</p>
          </div>
        </div>
        <div className="mt-6">
          <p className="mb-2 font-semibold">Date & Time:</p>
          <div className="border-b border-black pt-8 w-64"></div>
        </div>
      </div>
    </div>
  );
};

export default ProductionReceipt;
