import html2pdf from 'html2pdf.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
 * Generates a single multi-page PDF with each receipt on a separate page
 * Uses jsPDF directly for reliable page breaks with custom page sizes (80mm receipts)
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
  // Page dimensions in mm
  const pageWidth = format === 'a4' ? 210 : 80;
  const pageHeight = format === 'a4' ? 297 : 297;
  const margin = format === 'a4' ? 10 : 5;
  const contentWidth = pageWidth - (margin * 2);
  
  // Create jsPDF instance
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: format === 'a4' ? 'a4' : [pageWidth, pageHeight]
  });
  
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    
    if (onProgress) {
      onProgress(i + 1, receipts.length);
    }
    
    // Add new page for each receipt after the first
    if (i > 0) {
      pdf.addPage();
    }
    
    // Render element to canvas
    const canvas = await html2canvas(receipt.element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    // Calculate dimensions to fit on page
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Add image to PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
  }
  
  // Return as blob
  return pdf.output('blob');
};

/**
 * Generates multiple supplier order PDFs and packages them in a ZIP file
 */
export const generateMultipleSupplierOrdersPDF = async (
  suppliers: Array<{
    element: HTMLElement;
    supplierName: string;
  }>,
  format: 'a4' | 'receipt' = 'a4',
  orderNumber: string,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> => {
  const zip = new JSZip();
  
  for (let i = 0; i < suppliers.length; i++) {
    const supplier = suppliers[i];
    
    // Notify progress
    if (onProgress) {
      onProgress(i + 1, suppliers.length);
    }
    
    // Clean supplier name for filename
    const cleanSupplierName = supplier.supplierName.replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `Supplier-${orderNumber}-${cleanSupplierName}.pdf`;
    
    // Generate PDF blob
    const pdfBlob = await generateReceiptPDF(supplier.element, filename, format);
    
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
