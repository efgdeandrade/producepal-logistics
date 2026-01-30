

# Plan: Download Each Supplier PO as Individual PDF Files

## Summary
Update the supplier order PDF generation to download each supplier as a completely separate PDF file - no ZIP packaging, no combined multi-page document. If there are 3 suppliers, the browser will download 3 individual PDF files.

---

## What Changes

### Current Behavior
- Multiple suppliers: Creates a ZIP file containing separate PDFs
- User must unzip to access individual files

### New Behavior  
- Each supplier PO downloads as its own PDF file
- 3 suppliers = 3 separate PDF downloads
- Files named: `Supplier-{order_number}-{supplier_name}.pdf`

---

## Files to Modify

### 1. `src/utils/receiptGenerator.ts`

**Change:** Create new function `generateAndDownloadSupplierPDFs` that generates and downloads each PDF individually

```typescript
// New function - generates each supplier PDF and downloads immediately
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
```

### 2. `src/pages/OrderDetails.tsx`

**Change:** Update the supplier download logic to use the new function

**Current code (lines 534-561):**
```typescript
if (supplierDivs.length > 1) {
  // Multiple suppliers - create ZIP
  const suppliers = Array.from(supplierDivs).map(...);
  const zipBlob = await generateMultipleSupplierOrdersPDF(...);
  const zipFilename = `Supplier-Orders-${order.order_number}.zip`;
  downloadBlob(zipBlob, zipFilename);
  toast.success(`Downloaded ${suppliers.length} supplier orders in ZIP file`);
}
```

**New code:**
```typescript
// Gather all suppliers
const suppliers = Array.from(supplierDivs).map((div) => {
  const supplierName = div.getAttribute('data-supplier') || 'Unknown';
  return {
    element: div as HTMLElement,
    supplierName
  };
});

// Download each as separate PDF
await generateAndDownloadSupplierPDFs(
  suppliers,
  printFormat,
  order.order_number,
  (current, total) => {
    toast.loading(`Downloading supplier order ${current} of ${total}...`, { id: 'supplier-progress' });
  }
);

toast.dismiss('supplier-progress');
toast.success(`Downloaded ${suppliers.length} supplier order PDFs`);
```

---

## Technical Details

### Download Delay
A 300ms delay between downloads prevents browser blocking issues when triggering multiple file downloads in sequence. Some browsers may block rapid successive downloads.

### File Naming
Each file is named clearly: `Supplier-{order_number}-{supplier_name}.pdf`
- Example: `Supplier-ORD-001-Fresh-Farms.pdf`
- Special characters in supplier names are replaced with hyphens

### Browser Behavior
- Modern browsers will either:
  - Download all files to the Downloads folder
  - Show a permission prompt for multiple downloads (first time only)
- Files appear as separate entries in download history

---

## Result

After implementation:
- Order with 3 suppliers = 3 individual PDF files downloaded
- Each file named with supplier name for easy identification
- No ZIP extraction required
- Clean, separate documents ready for printing/emailing to each supplier

