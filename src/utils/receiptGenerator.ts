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
 * For receipts, uses auto-height to fit all content on one page (continuous thermal paper)
 * For A4, scales content to fit if needed
 */
export const generateReceiptPDF = async (
  element: HTMLElement,
  filename: string,
  format: 'a4' | 'receipt' = 'a4'
): Promise<Blob> => {
  // First render to canvas to measure content
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: '#ffffff'
  });
  
  const margin = format === 'a4' ? 10 : 5;
  const pageWidth = format === 'a4' ? 210 : 80;
  const contentWidth = pageWidth - (margin * 2);
  
  // Calculate actual content height based on aspect ratio
  const imgHeight = (canvas.height * contentWidth) / canvas.width;
  
  // For receipts: use content height + margins (continuous paper)
  // For A4: use standard height but scale if content is too tall
  let pageHeight: number;
  let finalImgHeight = imgHeight;
  let finalImgWidth = contentWidth;
  
  if (format === 'receipt') {
    // Thermal receipt: page height matches content (continuous roll)
    pageHeight = imgHeight + (margin * 2);
  } else {
    // A4: fixed height, scale down content if it exceeds page
    pageHeight = 297;
    const maxContentHeight = pageHeight - (margin * 2);
    
    if (imgHeight > maxContentHeight) {
      // Scale down to fit on one page
      const scale = maxContentHeight / imgHeight;
      finalImgHeight = maxContentHeight;
      finalImgWidth = contentWidth * scale;
    }
  }
  
  // Create PDF with calculated dimensions
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: format === 'a4' ? 'a4' : [pageWidth, pageHeight]
  });
  
  const imgData = canvas.toDataURL('image/jpeg', 0.98);
  
  // Center content horizontally if scaled down
  const xOffset = format === 'a4' ? margin + (contentWidth - finalImgWidth) / 2 : margin;
  pdf.addImage(imgData, 'JPEG', xOffset, margin, finalImgWidth, finalImgHeight);
  
  return pdf.output('blob');
};

/**
 * Generates a single multi-page PDF with each receipt on a separate page
 * For receipts: each page auto-sizes to fit content (continuous thermal paper simulation)
 * For A4: scales content to fit on standard pages
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
  const margin = format === 'a4' ? 10 : 5;
  const pageWidth = format === 'a4' ? 210 : 80;
  const contentWidth = pageWidth - (margin * 2);
  const a4PageHeight = 297;
  const a4MaxContentHeight = a4PageHeight - (margin * 2);
  
  let pdf: jsPDF | null = null;
  
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    
    if (onProgress) {
      onProgress(i + 1, receipts.length);
    }
    
    // Render element to canvas
    const canvas = await html2canvas(receipt.element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    // Calculate content dimensions
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let pageHeight: number;
    let finalImgHeight = imgHeight;
    let finalImgWidth = imgWidth;
    
    if (format === 'receipt') {
      // Thermal receipt: page height matches content
      pageHeight = imgHeight + (margin * 2);
    } else {
      // A4: fixed height, scale down if needed
      pageHeight = a4PageHeight;
      if (imgHeight > a4MaxContentHeight) {
        const scale = a4MaxContentHeight / imgHeight;
        finalImgHeight = a4MaxContentHeight;
        finalImgWidth = imgWidth * scale;
      }
    }
    
    if (i === 0) {
      // Create PDF with first page dimensions
      pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: format === 'a4' ? 'a4' : [pageWidth, pageHeight]
      });
    } else {
      // Add new page with custom dimensions for this receipt
      pdf!.addPage(format === 'a4' ? 'a4' : [pageWidth, pageHeight]);
    }
    
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const xOffset = format === 'a4' ? margin + (contentWidth - finalImgWidth) / 2 : margin;
    pdf!.addImage(imgData, 'JPEG', xOffset, margin, finalImgWidth, finalImgHeight);
  }
  
  // Return as blob
  return pdf!.output('blob');
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
