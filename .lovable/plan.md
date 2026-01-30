

# Fix Blank Page During Print

## Problem Analysis

When you click Print, the page goes blank because an unhandled error crashes the React application. This happens during PDF generation when:

1. The logo image hasn't fully loaded when `html2canvas` tries to capture it
2. Canvas operations fail silently and crash the app
3. No global error handler catches these promise rejections

## Solution

We need to implement three fixes:

1. **Add robust error handling** to the print and download functions
2. **Wait for images to load** before capturing the page
3. **Add a global unhandled rejection handler** as a safety net

---

## Technical Implementation

### File 1: `src/utils/receiptGenerator.ts`

**Changes:**
- Add image preloading before `html2canvas` capture
- Wrap canvas operations in try-catch
- Add timeout protection for image loading

```typescript
// Add helper function to wait for all images to load
const waitForImages = async (element: HTMLElement, timeout = 5000): Promise<void> => {
  const images = element.querySelectorAll('img');
  const loadPromises = Array.from(images).map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timeoutId = setTimeout(resolve, timeout);
      img.onload = () => { clearTimeout(timeoutId); resolve(); };
      img.onerror = () => { clearTimeout(timeoutId); resolve(); };
    });
  });
  await Promise.all(loadPromises);
};

// Update generateReceiptPDF to wait for images
export const generateReceiptPDF = async (...) => {
  try {
    // Wait for images to load first
    await waitForImages(element);
    
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true, // Changed: allow tainted canvas as fallback
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc) => {
        // Ensure images are visible in cloned document
        const images = clonedDoc.querySelectorAll('img');
        images.forEach(img => {
          img.style.visibility = 'visible';
        });
      }
    });
    // ... rest of the function
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
};
```

### File 2: `src/pages/OrderDetails.tsx`

**Changes to `handlePrintFromPreview`:**
- Add loading indicator during PDF generation
- Improve error handling with user-friendly messages
- Add small delay before capture to ensure render is complete

```typescript
const handlePrintFromPreview = async () => {
  if (!printRef.current || !order) return;

  // Add loading state
  setGeneratingPDF(true);
  
  try {
    // Small delay to ensure DOM is fully rendered
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const filename = `${viewDialog || 'document'}-${order.order_number}.pdf`;
    const pdfBlob = await generateReceiptPDF(printRef.current, filename, printFormat);
    
    if (!pdfBlob || pdfBlob.size === 0) {
      throw new Error('Generated PDF is empty');
    }
    
    const url = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(url, '_blank');
    
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to print.');
      URL.revokeObjectURL(url);
      return;
    }
    
    printWindow.addEventListener('load', () => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }, { once: true });
    
  } catch (error) {
    console.error('Print failed:', error);
    toast.error('Failed to generate PDF. Please try again.');
  } finally {
    setGeneratingPDF(false);
  }
};
```

### File 3: `src/App.tsx`

**Add global unhandled rejection handler:**

```typescript
// Inside App component or as a useEffect in a wrapper
useEffect(() => {
  const handleRejection = (event: PromiseRejectionEvent) => {
    console.error("Unhandled promise rejection:", event.reason);
    // Don't crash the app, just log and show error
    event.preventDefault();
  };

  window.addEventListener("unhandledrejection", handleRejection);
  return () => window.removeEventListener("unhandledrejection", handleRejection);
}, []);
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/utils/receiptGenerator.ts` | Add `waitForImages` helper, improve `html2canvas` options, add try-catch |
| `src/pages/OrderDetails.tsx` | Add loading state, delay before capture, better error messages |
| `src/App.tsx` | Add global `unhandledrejection` handler |

## Expected Result

- Print button will show loading state while generating
- If images haven't loaded, will wait up to 5 seconds
- Errors will show a toast message instead of crashing
- No more blank pages

