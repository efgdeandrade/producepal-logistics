import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';

interface ExportMetadata {
  calculationType: 'estimate' | 'actual';
  exchangeRate: number;
  freightExteriorPerKg: number;
  freightLocalPerKg: number;
  freightChampionCost?: number;
  swissportCost?: number;
  totalPallets: number;
  totalChargeableWeight: number;
  totalActualWeight: number;
  totalVolumetricWeight: number;
  distributionMethod: string;
  limitingFactor: string;
}

interface ProductExport {
  code: string;
  name: string;
  quantity: number;
  weightPerUnit: number;
  totalWeight: number;
  freightAllocated: number;
  cifPerUnit: number;
  wholesalePrice?: number;
  margin?: number;
}

export const exportToExcel = (
  metadata: ExportMetadata,
  products: ProductExport[],
  filename: string = 'CIF_Calculation.xlsx'
) => {
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData: any[][] = [
    ['CIF Calculation Summary'],
    [''],
    ['Type', metadata.calculationType.toUpperCase()],
    ['Date', new Date().toLocaleDateString()],
    [''],
    ['Exchange Rates & Costs'],
    ['Exchange Rate (USD to XCG)', metadata.exchangeRate],
    ['Freight Exterior (per kg)', metadata.freightExteriorPerKg],
    ['Freight Local (per kg)', metadata.freightLocalPerKg],
  ];

  if (metadata.calculationType === 'actual') {
    summaryData.push(
      ['Champion Freight Cost', metadata.freightChampionCost || 0],
      ['Swissport Cost', metadata.swissportCost || 0]
    );
  }

  summaryData.push(
    [''],
    ['Totals'],
    ['Total Pallets', metadata.totalPallets],
    ['Total Actual Weight (kg)', metadata.totalActualWeight.toFixed(2)],
    ['Total Volumetric Weight (kg)', metadata.totalVolumetricWeight.toFixed(2)],
    ['Total Chargeable Weight (kg)', metadata.totalChargeableWeight.toFixed(2)],
    ['Limiting Factor', metadata.limitingFactor],
    ['Distribution Method', metadata.distributionMethod]
  );

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Products Sheet
  const productsData = [
    ['Product Code', 'Product Name', 'Quantity', 'Weight/Unit (kg)', 'Total Weight (kg)', 
     'Freight Allocated (USD)', 'CIF per Unit (XCG)', 'Wholesale Price (XCG)', 'Margin (XCG)']
  ];

  products.forEach(product => {
    productsData.push([
      product.code,
      product.name,
      product.quantity.toString(),
      product.weightPerUnit.toFixed(3),
      product.totalWeight.toFixed(2),
      product.freightAllocated.toFixed(2),
      product.cifPerUnit.toFixed(2),
      product.wholesalePrice?.toFixed(2) || 'N/A',
      product.margin?.toFixed(2) || 'N/A'
    ]);
  });

  const productsSheet = XLSX.utils.aoa_to_sheet(productsData);
  XLSX.utils.book_append_sheet(workbook, productsSheet, 'Products');

  // Download
  XLSX.writeFile(workbook, filename);
};

export const exportToPDF = async (
  elementId: string,
  filename: string = 'CIF_Calculation.pdf'
) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found for PDF export');
    return;
  }

  const opt = {
    margin: 10,
    filename: filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const }
  };

  try {
    await html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};

export const printCalculation = () => {
  window.print();
};
