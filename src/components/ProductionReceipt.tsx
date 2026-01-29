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
    <div className="receipt-page bg-white text-black p-4 high-contrast-print font-sans">
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
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
        .receipt-page {
          width: 80mm;
          max-width: 80mm;
          font-family: Arial, Helvetica, sans-serif;
        }
      `}</style>
      
      {/* Header */}
      <div className="border-b-4 border-black pb-2 mb-3 text-center">
        <h1 className="text-xl font-extrabold mb-1">PRODUCTION RECEIPT</h1>
        <div className="text-sm font-bold">
          <p>{format(new Date(deliveryDate), 'MMM d, yyyy')}</p>
          <p>{format(new Date(), 'MMM d, yyyy HH:mm')}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-3 pb-2 border-b-2 border-black">
        <p className="text-sm font-bold">CUSTOMER:</p>
        <p className="font-extrabold text-base">{customerName}</p>
      </div>

      {/* Items by Category */}
      <div className="mb-3">
        {activeCategories.map(([category, categoryItems]) => (
          <div key={category} className="mb-3">
            <p className="text-sm font-extrabold border-b-2 border-black pb-1 mb-2">{category}</p>
            <table className="w-full text-sm mb-2">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-1 font-extrabold">Product</th>
                  <th className="text-center py-1 w-12 font-extrabold">Tgt</th>
                  <th className="text-center py-1 w-12 font-extrabold">Qty</th>
                </tr>
              </thead>
              <tbody>
                {categoryItems
                  .filter(item => (item.actual_quantity || 0) > 0)
                  .map((item) => (
                    <tr key={item.id} className="border-b-2 border-black">
                      <td className="py-1 text-sm font-bold">{item.product_name}</td>
                      <td className="py-1 text-center text-sm font-bold">
                        {item.predicted_quantity}
                      </td>
                      <td className="py-1 text-center font-extrabold">
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
      <div className="border-t-4 border-black pt-2 mb-3">
        <div className="flex justify-between font-extrabold text-base">
          <span>TOTAL ITEMS:</span>
          <span>{totalItems}</span>
        </div>
      </div>

      {/* Signature Section */}
      <div className="border-t-2 border-black pt-3 mt-4 text-sm">
        <div className="mb-3">
          <p className="mb-1 font-bold">Delivered By:</p>
          <div className="border-b-2 border-black pt-6"></div>
        </div>
        <div className="mb-3">
          <p className="mb-1 font-bold">Received By:</p>
          <div className="border-b-2 border-black pt-6"></div>
        </div>
        <div className="mb-3">
          <p className="mb-1 font-bold">Date & Time:</p>
          <div className="border-b-2 border-black pt-6"></div>
        </div>
      </div>
      
      <div className="text-center text-sm mt-4 border-t-2 border-black pt-2">
        <p className="font-bold">Thank you!</p>
      </div>
    </div>
  );
};

export default ProductionReceipt;
