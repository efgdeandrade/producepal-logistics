import { forwardRef } from 'react';

interface InvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface InvoiceProps {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  total: number;
  format?: '80mm' | 'a4';
}

export const Invoice = forwardRef<HTMLDivElement, InvoiceProps>(
  (
    {
      invoiceNumber,
      invoiceDate,
      customerName,
      customerAddress,
      customerPhone,
      items,
      subtotal,
      total,
      format = '80mm',
    },
    ref
  ) => {
    const is80mm = format === '80mm';

    return (
      <div
        ref={ref}
        className={`bg-white text-black ${
          is80mm ? 'w-[80mm] p-3 text-xs' : 'w-[210mm] p-8 text-sm'
        }`}
        style={{ fontFamily: 'monospace' }}
      >
        {/* Header */}
        <div className={`text-center ${is80mm ? 'mb-3' : 'mb-6'}`}>
          <img
            src="/logo.png"
            alt="FUIK COMPANY B.V."
            className={`mx-auto ${is80mm ? 'h-8 mb-2' : 'h-12 mb-3'}`}
          />
          <div className={`font-bold ${is80mm ? 'text-sm' : 'text-lg'}`}>
            FUIK COMPANY B.V.
          </div>
          <div className={is80mm ? 'text-[10px]' : 'text-xs'}>
            Reigerweg 21
          </div>
          <div className={is80mm ? 'text-[10px]' : 'text-xs'}>
            Tel: 7363845
          </div>
          <div className={is80mm ? 'text-[10px]' : 'text-xs'}>
            Email: info@fuik.co
          </div>
          <div className={is80mm ? 'text-[10px]' : 'text-xs'}>
            CRIB: 102649479
          </div>
        </div>

        {/* Divider */}
        <div className={`border-t-2 border-black ${is80mm ? 'my-2' : 'my-4'}`} />

        {/* Invoice Info */}
        <div className={is80mm ? 'mb-2' : 'mb-4'}>
          <div className="flex justify-between">
            <span className="font-bold">Invoice:</span>
            <span>{invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">Date:</span>
            <span>{invoiceDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">Payment:</span>
            <span>Due on Receipt</span>
          </div>
        </div>

        {/* Customer Info */}
        <div className={`${is80mm ? 'mb-2' : 'mb-4'}`}>
          <div className="font-bold">Bill To:</div>
          <div>{customerName}</div>
          {customerAddress && <div className={is80mm ? 'text-[10px]' : 'text-xs'}>{customerAddress}</div>}
          {customerPhone && <div className={is80mm ? 'text-[10px]' : 'text-xs'}>Tel: {customerPhone}</div>}
        </div>

        {/* Divider */}
        <div className={`border-t-2 border-black ${is80mm ? 'my-2' : 'my-4'}`} />

        {/* Items Table */}
        <div className={is80mm ? 'mb-2' : 'mb-4'}>
          {/* Table Header */}
          <div className="flex border-b border-black pb-1 mb-1 font-bold">
            <div className="flex-1">Product</div>
            <div className="w-12 text-center">Qty</div>
            <div className="w-16 text-right">Price</div>
            <div className="w-16 text-right">Total</div>
          </div>

          {/* Table Items */}
          {items.map((item, index) => (
            <div key={index} className={`flex ${is80mm ? 'mb-1' : 'mb-2'}`}>
              <div className="flex-1 break-words pr-2">{item.product_name}</div>
              <div className="w-12 text-center">{item.quantity}</div>
              <div className="w-16 text-right">
                {item.unit_price.toFixed(2)}
              </div>
              <div className="w-16 text-right font-bold">
                {item.line_total.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className={`border-t-2 border-black ${is80mm ? 'my-2' : 'my-4'}`} />

        {/* Totals */}
        <div className={is80mm ? 'mb-2' : 'mb-4'}>
          <div className="flex justify-between">
            <span className="font-bold">Subtotal:</span>
            <span>Cg {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>TOTAL:</span>
            <span>Cg {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className={`border-t border-black pt-2 text-center ${is80mm ? 'text-[10px]' : 'text-xs'}`}>
          <div>Thank you for your business!</div>
        </div>
      </div>
    );
  }
);

Invoice.displayName = 'Invoice';
