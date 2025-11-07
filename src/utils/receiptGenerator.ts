import html2pdf from 'html2pdf.js';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';

export interface ReceiptData {
  receiptNumber: string;
  customerName: string;
  customerId?: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  deliveryDate: string;
}

/**
 * Generates a unique sequential receipt number
 */
export const generateReceiptNumber = async (): Promise<string> => {
  const { data, error } = await supabase.rpc('generate_receipt_number');
  
  if (error) {
    console.error('Error generating receipt number:', error);
    throw new Error('Failed to generate receipt number');
  }
  
  return data;
};

/**
 * Saves receipt record to database
 */
export const saveReceiptRecord = async (receiptData: ReceiptData): Promise<void> => {
  const { error } = await supabase.from('receipt_numbers').insert({
    receipt_number: receiptData.receiptNumber,
    order_id: receiptData.orderId,
    customer_name: receiptData.customerName,
    customer_id: receiptData.customerId || null,
    order_number: receiptData.orderNumber,
    amount: receiptData.amount,
    delivery_date: receiptData.deliveryDate,
    generated_by: (await supabase.auth.getUser()).data.user?.id
  });
  
  if (error) {
    console.error('Error saving receipt record:', error);
    throw new Error('Failed to save receipt record');
  }
};

/**
 * Generates a single receipt PDF as a blob
 */
export const generateReceiptPDF = async (
  element: HTMLElement,
  filename: string,
  format: 'a4' | 'receipt' = 'a4'
): Promise<Blob> => {
  const opt = {
    margin: format === 'a4' ? 10 : 5,
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: {
      unit: 'mm' as const,
      format: format === 'a4' ? 'a4' as const : [80, 297] as [number, number],
      orientation: 'portrait' as const
    }
  };

  return new Promise((resolve, reject) => {
    html2pdf()
      .set(opt)
      .from(element)
      .outputPdf('blob')
      .then((blob: Blob) => resolve(blob))
      .catch((error: Error) => reject(error));
  });
};

/**
 * Generates multiple receipt PDFs and packages them in a ZIP file
 */
export const generateMultipleReceiptsPDF = async (
  receipts: Array<{
    element: HTMLElement;
    receiptNumber: string;
    customerName: string;
  }>,
  format: 'a4' | 'receipt' = 'a4',
  orderNumber: string,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> => {
  const zip = new JSZip();
  
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    
    // Notify progress
    if (onProgress) {
      onProgress(i + 1, receipts.length);
    }
    
    // Clean customer name for filename
    const cleanCustomerName = receipt.customerName.replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `${receipt.receiptNumber}-${cleanCustomerName}.pdf`;
    
    // Generate PDF blob
    const pdfBlob = await generateReceiptPDF(receipt.element, filename, format);
    
    // Add to ZIP
    zip.file(filename, pdfBlob);
  }
  
  // Generate ZIP file
  return await zip.generateAsync({ type: 'blob' });
};

/**
 * Downloads a blob as a file
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
