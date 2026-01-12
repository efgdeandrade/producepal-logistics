import { forwardRef } from 'react';

interface InvoiceLineItem {
  product_name: string;
  description?: string;
  quantity: number;
  unit_price_xcg: number;
  line_total_xcg: number;
  is_ob_eligible?: boolean;
  ob_tax_inclusive?: number;
}

interface FnbInvoicePreviewProps {
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerMemo?: string;
  orderNumbers?: string[];
  items: InvoiceLineItem[];
  subtotal: number;
  obTax: number;
  total: number;
  format?: '80mm' | 'a4';
}

export const FnbInvoicePreview = forwardRef<HTMLDivElement, FnbInvoicePreviewProps>(
  (
    {
      invoiceDate,
      dueDate,
      customerName,
      customerAddress,
      customerPhone,
      customerMemo,
      orderNumbers = [],
      items,
      subtotal,
      obTax,
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

        {/* Invoice Title */}
        <div className={`text-center font-bold ${is80mm ? 'text-sm mb-2' : 'text-lg mb-4'}`}>
          INVOICE
        </div>

        {/* Invoice Info */}
        <div className={is80mm ? 'mb-2' : 'mb-4'}>
          <div className="flex justify-between">
            <span className="font-bold">Date:</span>
            <span>{invoiceDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">Due Date:</span>
            <span>{dueDate}</span>
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
          <div className={`flex border-b border-black pb-1 mb-1 font-bold ${is80mm ? 'text-[10px]' : ''}`}>
            <div className="flex-1">Product</div>
            {!is80mm && <div className="w-24">Description</div>}
            <div className={`text-center ${is80mm ? 'w-8' : 'w-12'}`}>Qty</div>
            <div className={`text-right ${is80mm ? 'w-14' : 'w-20'}`}>Rate</div>
            <div className={`text-right ${is80mm ? 'w-14' : 'w-20'}`}>Amount</div>
          </div>

          {/* Table Items */}
          {items.map((item, index) => (
            <div key={index} className={`flex ${is80mm ? 'mb-1 text-[10px]' : 'mb-2'}`}>
              <div className="flex-1 break-words pr-1">
                {item.product_name}
                {item.is_ob_eligible && <span className="text-gray-500"> *</span>}
              </div>
              {!is80mm && <div className="w-24 text-gray-600">{item.description || '-'}</div>}
              <div className={`text-center ${is80mm ? 'w-8' : 'w-12'}`}>
                {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)}
              </div>
              <div className={`text-right ${is80mm ? 'w-14' : 'w-20'}`}>
                {item.unit_price_xcg.toFixed(2)}
              </div>
              <div className={`text-right font-bold ${is80mm ? 'w-14' : 'w-20'}`}>
                {item.line_total_xcg.toFixed(2)}
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
            <span>XCG {subtotal.toFixed(2)}</span>
          </div>
          {obTax > 0 && (
            <div className={`flex justify-between ${is80mm ? 'text-[10px]' : 'text-xs'} text-gray-600`}>
              <span>* O.B. @ 6% (inclusive):</span>
              <span>XCG {obTax.toFixed(2)}</span>
            </div>
          )}
          <div className={`flex justify-between font-bold ${is80mm ? 'text-sm' : 'text-lg'} mt-1`}>
            <span>TOTAL:</span>
            <span>XCG {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Customer Memo */}
        {customerMemo && (
          <>
            <div className={`border-t border-black ${is80mm ? 'my-2' : 'my-4'}`} />
            <div className={is80mm ? 'text-[10px]' : 'text-xs'}>
              <div className="font-bold">Memo:</div>
              <div>{customerMemo}</div>
            </div>
          </>
        )}

        {/* Order Reference */}
        {orderNumbers.length > 0 && (
          <div className={`${is80mm ? 'text-[10px] mt-2' : 'text-xs mt-4'} text-gray-600`}>
            <div>Orders: {orderNumbers.join(', ')}</div>
          </div>
        )}

        {/* Footer */}
        <div className={`border-t border-black pt-2 text-center ${is80mm ? 'text-[10px] mt-2' : 'text-xs mt-4'}`}>
          <div>Thank you for your business!</div>
        </div>
      </div>
    );
  }
);

FnbInvoicePreview.displayName = 'FnbInvoicePreview';
