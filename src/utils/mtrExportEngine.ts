/**
 * MTR – Mobile Thermal Receipt Export Engine
 *
 * Renders receipt data to a raster canvas at 203 DPI (standard thermal),
 * then exports as PNG or PDF. Designed for iOS PWA where Web Bluetooth
 * is not available – users share/download the image to a printer app.
 */

// ─── MTR Profile ─────────────────────────────────────────────────────────────

export interface MTRProfile {
  code: 'MTR';
  name: string;
  paperWidthMm: number;
  printableWidthMm: number;
  dpi: number;
  feedLinesAfter: number;
}

export const DEFAULT_MTR_PROFILE: MTRProfile = {
  code: 'MTR',
  name: 'Mobile Thermal Receipt (MTR)',
  paperWidthMm: 80,
  printableWidthMm: 72,
  dpi: 203,
  feedLinesAfter: 5,
};

// ─── Receipt Data Model ──────────────────────────────────────────────────────

export interface MTRLineItem {
  name: string;
  qty: number;
  rate: number;
  amount: number;
  obEligible?: boolean;
}

export interface MTRReceiptData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  storeCrib?: string;

  title: string; // "INVOICE" / "RECEIPT"
  date: string;
  dueDate?: string;
  paymentTerms?: string;

  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerMemo?: string;

  items: MTRLineItem[];
  subtotal: number;
  obTax: number;
  total: number;

  orderRefs?: string[];
  footer?: string;
}

// ─── Gateway Config ──────────────────────────────────────────────────────────

export interface MTRGatewayConfig {
  enabled: boolean;
  url: string;
  apiKey?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);

/** Simple word-wrap for monospace canvas text. Returns array of lines. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

// ─── Raster Renderer ─────────────────────────────────────────────────────────

/**
 * Renders receipt data onto a canvas at the exact pixel width for the
 * configured DPI / printable width. Returns a canvas element.
 */
export function renderMTRCanvas(
  data: MTRReceiptData,
  profile: MTRProfile = DEFAULT_MTR_PROFILE
): HTMLCanvasElement {
  const widthPx = mmToPx(profile.printableWidthMm, profile.dpi);
  const lineH = 18; // line height in px
  const smallLineH = 15;
  const padding = 8;
  const colGap = 6;

  // Pre-calculate height so we can size the canvas before drawing.
  // We'll do a two-pass approach: measure then draw.
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = widthPx;
  tempCanvas.height = 1;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.font = 'bold 16px monospace';

  let estimatedLines = 0;
  // Header: store name + 4 info lines + blank
  estimatedLines += 7;
  // Title
  estimatedLines += 2;
  // Date / due / payment
  estimatedLines += 3;
  // Customer
  estimatedLines += 3;
  // Dividers
  estimatedLines += 4;
  // Items header
  estimatedLines += 1;

  // Items (with wrapping)
  const qtyW = 40;
  const rateW = 60;
  const amtW = 65;
  const nameMaxW = widthPx - padding * 2 - qtyW - rateW - amtW - colGap * 3;

  for (const item of data.items) {
    tempCtx.font = '14px monospace';
    const wrapped = wrapText(tempCtx, item.name + (item.obEligible ? ' *' : ''), Math.max(nameMaxW, 60));
    estimatedLines += Math.max(wrapped.length, 1);
  }

  // Totals
  estimatedLines += 3;
  if (data.obTax > 0) estimatedLines += 1;
  // Memo
  if (data.customerMemo) estimatedLines += 3;
  // Order refs
  if (data.orderRefs?.length) estimatedLines += 2;
  // Footer
  estimatedLines += 2;
  // Feed lines
  estimatedLines += profile.feedLinesAfter;

  const heightPx = Math.max(estimatedLines * lineH + 80, 200);

  // ── Actual canvas ──
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);
  ctx.fillStyle = '#000000';

  let y = padding;
  const left = padding;
  const right = widthPx - padding;
  const center = widthPx / 2;

  const drawCentered = (text: string, fontSize: number, bold = false) => {
    ctx.font = `${bold ? 'bold ' : ''}${fontSize}px monospace`;
    const w = ctx.measureText(text).width;
    ctx.fillText(text, center - w / 2, y);
    y += fontSize < 14 ? smallLineH : lineH;
  };

  const drawRow = (left_text: string, right_text: string, fontSize = 14, bold = false) => {
    ctx.font = `${bold ? 'bold ' : ''}${fontSize}px monospace`;
    ctx.fillText(left_text, left, y);
    const rw = ctx.measureText(right_text).width;
    ctx.fillText(right_text, right - rw, y);
    y += fontSize < 14 ? smallLineH : lineH;
  };

  const drawDivider = (thick = false) => {
    ctx.beginPath();
    ctx.lineWidth = thick ? 2 : 1;
    ctx.moveTo(left, y - 4);
    ctx.lineTo(right, y - 4);
    ctx.stroke();
    y += 6;
  };

  // ── Header ──
  drawCentered(data.storeName, 16, true);
  if (data.storeAddress) drawCentered(data.storeAddress, 12);
  if (data.storePhone) drawCentered(`Tel: ${data.storePhone}`, 12);
  if (data.storeEmail) drawCentered(`Email: ${data.storeEmail}`, 12);
  if (data.storeCrib) drawCentered(`CRIB: ${data.storeCrib}`, 12);
  y += 4;

  drawDivider(true);

  // ── Title ──
  drawCentered(data.title, 16, true);
  y += 2;

  // ── Invoice info ──
  drawRow('Date:', data.date, 14, true);
  if (data.dueDate) drawRow('Due Date:', data.dueDate, 14, true);
  if (data.paymentTerms) drawRow('Payment:', data.paymentTerms, 14, true);
  y += 2;

  // ── Customer ──
  ctx.font = 'bold 14px monospace';
  ctx.fillText('Bill To:', left, y);
  y += lineH;
  ctx.font = '14px monospace';
  ctx.fillText(data.customerName, left, y);
  y += lineH;
  if (data.customerAddress) {
    const addrLines = wrapText(ctx, data.customerAddress, right - left);
    for (const line of addrLines) {
      ctx.font = '12px monospace';
      ctx.fillText(line, left, y);
      y += smallLineH;
    }
  }
  if (data.customerPhone) {
    ctx.font = '12px monospace';
    ctx.fillText(`Tel: ${data.customerPhone}`, left, y);
    y += smallLineH;
  }

  drawDivider(true);

  // ── Items header ──
  ctx.font = 'bold 12px monospace';
  const qtyX = right - amtW - rateW - qtyW - colGap * 2;
  const rateX = right - amtW - rateW - colGap;
  const amtX = right - amtW;
  ctx.fillText('Product', left, y);
  const qtyLabel = 'Qty';
  ctx.fillText(qtyLabel, qtyX + (qtyW - ctx.measureText(qtyLabel).width) / 2, y);
  const rateLabel = 'Rate';
  ctx.fillText(rateLabel, rateX + rateW - ctx.measureText(rateLabel).width, y);
  const amtLabel = 'Amount';
  ctx.fillText(amtLabel, amtX + amtW - ctx.measureText(amtLabel).width, y);
  y += lineH;

  // Thin divider
  ctx.beginPath();
  ctx.lineWidth = 0.5;
  ctx.moveTo(left, y - 6);
  ctx.lineTo(right, y - 6);
  ctx.stroke();

  // ── Items ──
  for (const item of data.items) {
    ctx.font = '13px monospace';
    const nameText = item.name + (item.obEligible ? ' *' : '');
    const nameLines = wrapText(ctx, nameText, Math.max(nameMaxW, 60));

    const qtyStr = item.qty % 1 === 0 ? String(item.qty) : item.qty.toFixed(2);
    const rateStr = item.rate.toFixed(2);
    const amtStr = item.amount.toFixed(2);

    // First line with numbers
    ctx.font = '13px monospace';
    ctx.fillText(nameLines[0], left, y);
    ctx.fillText(qtyStr, qtyX + (qtyW - ctx.measureText(qtyStr).width) / 2, y);
    ctx.fillText(rateStr, rateX + rateW - ctx.measureText(rateStr).width, y);
    ctx.font = 'bold 13px monospace';
    ctx.fillText(amtStr, amtX + amtW - ctx.measureText(amtStr).width, y);
    y += lineH;

    // Wrapped name continuation
    for (let i = 1; i < nameLines.length; i++) {
      ctx.font = '13px monospace';
      ctx.fillText(nameLines[i], left, y);
      y += smallLineH;
    }
  }

  drawDivider(true);

  // ── Totals ──
  drawRow('Subtotal:', `XCG ${data.subtotal.toFixed(2)}`, 14, true);
  if (data.obTax > 0) {
    ctx.font = '12px monospace';
    ctx.fillStyle = '#555555';
    drawRow('* O.B. @ 6% (incl.):', `XCG ${data.obTax.toFixed(2)}`, 12);
    ctx.fillStyle = '#000000';
  }
  ctx.font = 'bold 16px monospace';
  drawRow('TOTAL:', `XCG ${data.total.toFixed(2)}`, 16, true);

  // ── Customer Memo ──
  if (data.customerMemo) {
    drawDivider(false);
    ctx.font = 'bold 12px monospace';
    ctx.fillText('Memo:', left, y);
    y += smallLineH;
    ctx.font = '12px monospace';
    const memoLines = wrapText(ctx, data.customerMemo, right - left);
    for (const ml of memoLines) {
      ctx.fillText(ml, left, y);
      y += smallLineH;
    }
  }

  // ── Order refs ──
  if (data.orderRefs?.length) {
    ctx.font = '12px monospace';
    ctx.fillStyle = '#666666';
    y += 4;
    ctx.fillText(`Orders: ${data.orderRefs.join(', ')}`, left, y);
    y += smallLineH;
    ctx.fillStyle = '#000000';
  }

  // ── Footer ──
  drawDivider(false);
  drawCentered(data.footer || 'Thank you for your business!', 13);

  // Feed lines
  y += profile.feedLinesAfter * lineH;

  // Trim canvas to actual content height
  const trimmed = document.createElement('canvas');
  trimmed.width = widthPx;
  trimmed.height = Math.min(y + padding, heightPx);
  const tCtx = trimmed.getContext('2d')!;
  tCtx.fillStyle = '#ffffff';
  tCtx.fillRect(0, 0, trimmed.width, trimmed.height);
  tCtx.drawImage(canvas, 0, 0);

  return trimmed;
}

// ─── B/W Threshold ───────────────────────────────────────────────────────────

/** Converts canvas to pure black & white (1-bit threshold). */
export function applyBWThreshold(canvas: HTMLCanvasElement, threshold = 128): void {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const bw = gray >= threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = bw;
    d[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

// ─── Export: PNG ──────────────────────────────────────────────────────────────

export function mtrCanvasToPNGBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))),
      'image/png'
    );
  });
}

// ─── Export: PDF ──────────────────────────────────────────────────────────────

export async function mtrCanvasToPDFBlob(
  canvas: HTMLCanvasElement,
  profile: MTRProfile = DEFAULT_MTR_PROFILE
): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf');

  const mmToPt = (mm: number) => (mm / 25.4) * 72;
  const pageWidthPt = mmToPt(profile.paperWidthMm);
  const imgWidthPt = mmToPt(profile.printableWidthMm);
  const imgHeightPt = (canvas.height * imgWidthPt) / canvas.width;
  const marginX = (pageWidthPt - imgWidthPt) / 2;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [pageWidthPt, imgHeightPt + 20],
    hotfixes: ['px_scaling'],
  } as any);

  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', marginX, 10, imgWidthPt, imgHeightPt);
  return pdf.output('blob');
}

// ─── Share / Download ────────────────────────────────────────────────────────

export async function mtrShareOrDownload(
  blob: Blob,
  filename: string,
  mimeType: string
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: mimeType });

  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch {
      // User cancelled or share failed, fall through to download
    }
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return 'downloaded';
}

// ─── Gateway Print (future-proof stub) ───────────────────────────────────────

export async function mtrGatewayPrint(
  canvas: HTMLCanvasElement,
  config: MTRGatewayConfig
): Promise<{ ok: boolean; message: string }> {
  if (!config.enabled || !config.url) {
    return { ok: false, message: 'Gateway not configured' };
  }

  try {
    const blob = await mtrCanvasToPNGBlob(canvas);
    const formData = new FormData();
    formData.append('format', 'png');
    formData.append('payload', blob, 'receipt.png');

    const headers: Record<string, string> = {};
    if (config.apiKey) headers['X-API-Key'] = config.apiKey;

    const res = await fetch(config.url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      return { ok: false, message: `Gateway error: ${res.status}` };
    }
    return { ok: true, message: 'Sent to printer gateway' };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Gateway request failed' };
  }
}
