import html2pdf from 'html2pdf.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { waitForImages } from '@/utils/pdfDom';
import { renderIsolatedCanvas } from '@/utils/pdfCapture';

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
    const isReceipt = format === 'receipt';

    // --- Capture (isolated clone) ---
    if (isReceipt) {
      const pageWidthMm = 80;
      const canvas = await renderIsolatedCanvas(element, {
        widthMm: pageWidthMm,
        captureFullWidth: true,
        scale: 2,
        backgroundColor: '#ffffff',
      });

      // jsPDF can be finicky with custom sizes in `mm`.
      // For 80mm thermal, force `pt` with explicit pt dimensions.
      const pageWidthPt = mmToPt(pageWidthMm);
      const marginPt = 0; // zero margins – full 80mm width
      const imgWidthPt = pageWidthPt - marginPt * 2;
      const imgHeightPt = (canvas.height * imgWidthPt) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [pageWidthPt, imgHeightPt + marginPt * 2],
        hotfixes: ['px_scaling'],
      } as any);

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(imgData, 'JPEG', marginPt, marginPt, imgWidthPt, imgHeightPt);
      return pdf.output('blob');
    }

    // --- A4 ---
    const pageWidthMm = 210;
    const canvas = await renderIsolatedCanvas(element, {
      widthMm: pageWidthMm,
      scale: 2,
      backgroundColor: '#ffffff',
    });

    const marginMm = 10;
    const contentWidthMm = pageWidthMm - marginMm * 2;

    const imgHeightMm = (canvas.height * contentWidthMm) / canvas.width;

    const pageHeightMm = 297;
    const maxContentHeight = pageHeightMm - marginMm * 2;

    let finalImgHeight = imgHeightMm;
    let finalImgWidth = contentWidthMm;

    if (imgHeightMm > maxContentHeight) {
      const scale = maxContentHeight / imgHeightMm;
      finalImgHeight = maxContentHeight;
      finalImgWidth = contentWidthMm * scale;
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      hotfixes: ['px_scaling'],
    } as any);

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const xOffset = marginMm + (contentWidthMm - finalImgWidth) / 2;
    pdf.addImage(imgData, 'JPEG', xOffset, marginMm, finalImgWidth, finalImgHeight);

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
  const isReceipt = format === 'receipt';

  const pageWidthMm = isReceipt ? 80 : 210;
  const pageHeightMm = 297;
  const marginMm = isReceipt ? 0 : 10;

  // Receipt pages auto-size to content height; A4 uses fixed page height.
  const pageWidth = isReceipt ? mmToPt(pageWidthMm) : pageWidthMm;
  const contentWidth = isReceipt ? pageWidth : pageWidthMm - marginMm * 2;
  const a4MaxContentHeight = pageHeightMm - marginMm * 2;

  let pdf: jsPDF | null = null;

  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];

    onProgress?.(i + 1, receipts.length);

    // IMPORTANT: Use isolated capture for BOTH formats.
    // For thermal receipts this avoids dialog/transform scaling which is what makes the downloaded PDF look “narrow”.
    const canvas = await renderIsolatedCanvas(receipt.element, {
      widthMm: pageWidthMm,
      captureFullWidth: isReceipt,
      scale: 2,
      backgroundColor: '#ffffff',
    });

    if (isReceipt) {
      const pageWidthPt = mmToPt(pageWidthMm);
      const marginPt = 0; // zero margins – full 80mm width
      const imgWidthPt = pageWidthPt - marginPt * 2;
      const imgHeightPt = (canvas.height * imgWidthPt) / canvas.width;
      const pageHeightPt = imgHeightPt + marginPt * 2;

      if (i === 0) {
        pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'pt',
          format: [pageWidthPt, pageHeightPt],
          hotfixes: ['px_scaling'],
        } as any);
      } else {
        pdf!.addPage([pageWidthPt, pageHeightPt] as any);
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf!.addImage(imgData, 'JPEG', marginPt, marginPt, imgWidthPt, imgHeightPt);
      continue;
    }

    // --- A4 ---
    const imgWidthMm = contentWidth;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    let finalImgHeight = imgHeightMm;
    let finalImgWidth = imgWidthMm;

    if (imgHeightMm > a4MaxContentHeight) {
      const scale = a4MaxContentHeight / imgHeightMm;
      finalImgHeight = a4MaxContentHeight;
      finalImgWidth = imgWidthMm * scale;
    }

    if (i === 0) {
      pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        hotfixes: ['px_scaling'],
      } as any);
    } else {
      pdf!.addPage('a4');
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const xOffset = marginMm + (imgWidthMm - finalImgWidth) / 2;
    pdf!.addImage(imgData, 'JPEG', xOffset, marginMm, finalImgWidth, finalImgHeight);
  }

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
