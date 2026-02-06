import html2pdf from 'html2pdf.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { waitForImages } from '@/utils/pdfDom';

export interface ReceiptData {
  receiptNumber: string;
  customerName: string;
  customerId?: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  deliveryDate: string;
}

// jsPDF can be finicky with custom page sizes depending on unit handling.
// For thermal receipts we force unit=pt and provide explicit pt dimensions.
const mmToPt = (mm: number) => (mm / 25.4) * 72;

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
  try {
    // Wait for all images to load before capturing
    await waitForImages(element);
    
    const isReceipt = format === 'receipt';
    const targetWidthMm = isReceipt ? 80 : 210;
    
    // Store original styles to restore after capture
    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalMinWidth = element.style.minWidth;
    
    // Force element to exact target width for accurate capture
    element.style.width = `${targetWidthMm}mm`;
    element.style.maxWidth = `${targetWidthMm}mm`;
    element.style.minWidth = `${targetWidthMm}mm`;
    
    // Render to canvas - let html2canvas determine width from element
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc, clonedElement) => {
        // Ensure cloned element has exact width
        clonedElement.style.width = `${targetWidthMm}mm`;
        clonedElement.style.maxWidth = `${targetWidthMm}mm`;
        clonedElement.style.minWidth = `${targetWidthMm}mm`;
        // Ensure images are visible in cloned document
        const images = clonedDoc.querySelectorAll('img');
        images.forEach(img => {
          (img as HTMLElement).style.visibility = 'visible';
        });
      }
    });
    
    // Restore original styles
    element.style.width = originalWidth;
    element.style.maxWidth = originalMaxWidth;
    element.style.minWidth = originalMinWidth;
    
    // Dimensions in PDF units - use mm for both formats for consistency
    const margin = isReceipt ? 3 : 10; // mm
    const pageWidthMm = isReceipt ? 80 : 210;
    const contentWidthMm = pageWidthMm - margin * 2;
    
    // Calculate actual content height based on aspect ratio
    const imgHeightMm = (canvas.height * contentWidthMm) / canvas.width;
    
    // For receipts: use content height + margins (continuous paper)
    // For A4: use standard height but scale if content is too tall
    let pageHeightMm: number;
    let finalImgHeight = imgHeightMm;
    let finalImgWidth = contentWidthMm;
    
    if (isReceipt) {
      // Thermal receipt: page height matches content (continuous roll)
      pageHeightMm = imgHeightMm + margin * 2;
    } else {
      // A4: fixed height, scale down content if it exceeds page
      pageHeightMm = 297;
      const maxContentHeight = pageHeightMm - (margin * 2);
      
      if (imgHeightMm > maxContentHeight) {
        // Scale down to fit on one page
        const scale = maxContentHeight / imgHeightMm;
        finalImgHeight = maxContentHeight;
        finalImgWidth = contentWidthMm * scale;
      }
    }
    
    // Create PDF with calculated dimensions - always use mm for unit
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isReceipt ? [pageWidthMm, pageHeightMm] : 'a4',
      hotfixes: ['px_scaling'],
    } as any);
    
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    
    // Center content horizontally
    const xOffset = margin + (contentWidthMm - finalImgWidth) / 2;
    pdf.addImage(imgData, 'JPEG', xOffset, margin, finalImgWidth, finalImgHeight);
    
    return pdf.output('blob');
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
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
  const unit: 'mm' | 'pt' = format === 'receipt' ? 'pt' : 'mm';
  const margin = format === 'a4' ? 10 : mmToPt(5);
  const pageWidth = format === 'a4' ? 210 : mmToPt(80);
  const contentWidth = pageWidth - margin * 2;
  const a4PageHeight = 297;
  const a4MaxContentHeight = a4PageHeight - (margin * 2);
  
  let pdf: jsPDF | null = null;
  
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    
    if (onProgress) {
      onProgress(i + 1, receipts.length);
    }
    
    // Wait for assets (logo, etc.) to load before capturing
    await waitForImages(receipt.element);

    // Render element to canvas
    const canvas = await html2canvas(receipt.element, {
      scale: 2,
      useCORS: true,
      // Some browsers can mark canvases as tainted depending on image load behavior.
      // We prefer reliability for local/public assets used on receipts.
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc) => {
        // Ensure images remain visible in cloned document
        const images = clonedDoc.querySelectorAll('img');
        images.forEach((img) => {
          (img as HTMLElement).style.visibility = 'visible';
        });
      },
    });
    
    // Calculate content dimensions
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let pageHeight: number;
    let finalImgHeight = imgHeight;
    let finalImgWidth = imgWidth;
    
    if (format === 'receipt') {
      // Thermal receipt: page height matches content
      pageHeight = imgHeight + margin * 2;
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
        unit,
        format: format === 'a4' ? 'a4' : [pageWidth, pageHeight],
        hotfixes: ['px_scaling'],
      } as any);
    } else {
      // Add new page with custom dimensions for this receipt
      // jsPDF addPage can ignore array sizes unless unit/hotfix are consistent.
      pdf!.addPage(format === 'a4' ? 'a4' : ([pageWidth, pageHeight] as any));
    }
    
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    // Center content horizontally for both formats
    const xOffset = margin + (contentWidth - finalImgWidth) / 2;
    pdf!.addImage(imgData, 'JPEG', xOffset, margin, finalImgWidth, finalImgHeight);
  }
  
  // Return as blob
  return pdf!.output('blob');
};

/**
 * Generates and downloads each supplier order as a separate PDF file
 */
export const generateAndDownloadSupplierPDFs = async (
  suppliers: Array<{
    element: HTMLElement;
    supplierName: string;
  }>,
  format: 'a4' | 'receipt' = 'a4',
  orderNumber: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  for (let i = 0; i < suppliers.length; i++) {
    const supplier = suppliers[i];
    
    if (onProgress) {
      onProgress(i + 1, suppliers.length);
    }
    
    // Wait for images to load
    await waitForImages(supplier.element);
    
    // Clean supplier name for filename
    const cleanSupplierName = supplier.supplierName.replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `Supplier-${orderNumber}-${cleanSupplierName}.pdf`;
    
    // Generate PDF blob
    const pdfBlob = await generateReceiptPDF(supplier.element, filename, format);
    
    // Download immediately
    downloadBlob(pdfBlob, filename);
    
    // Small delay between downloads to prevent browser issues
    if (i < suppliers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
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
