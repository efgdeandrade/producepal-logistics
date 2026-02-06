import html2canvas from "html2canvas";
import { waitForImages } from "@/utils/pdfDom";

/**
 * Captures an element to a canvas using an isolated, off-screen clone.
 * This avoids layout differences caused by dialogs, parent transforms, zoom, flex constraints, etc.
 */
export const renderIsolatedCanvas = async (
  element: HTMLElement,
  opts: {
    widthMm: number;
    /** If true, capture full scrollWidth then scale into the target PDF width (prevents right-edge clipping). */
    captureFullWidth?: boolean;
    scale?: number;
    backgroundColor?: string;
  }
): Promise<HTMLCanvasElement> => {
  const {
    widthMm,
    captureFullWidth = false,
    scale = 2,
    backgroundColor = "#ffffff",
  } = opts;

  // Clone into an isolated off-screen wrapper so we don't inherit modal transforms.
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-pdf-capture-wrapper", "true");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-100000px";
  wrapper.style.top = "0";
  wrapper.style.width = `${widthMm}mm`;
  wrapper.style.background = backgroundColor;
  wrapper.style.transform = "none";
  wrapper.style.zIndex = "-1";
  wrapper.style.overflow = "visible";

  const clone = element.cloneNode(true) as HTMLElement;
  clone.setAttribute("data-pdf-capture-node", "true");
  clone.style.width = `${widthMm}mm`;
  clone.style.maxWidth = `${widthMm}mm`;
  clone.style.minWidth = `${widthMm}mm`;
  clone.style.boxSizing = "border-box";
  clone.style.margin = "0";
  clone.style.transform = "none";
  // Important: allow overflow while capturing full width, otherwise the right edge can be clipped.
  clone.style.overflow = captureFullWidth ? "visible" : "hidden";

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    // Ensure fonts are ready (prevents text reflow after capture starts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fontsReady = (document as any).fonts?.ready;
    if (fontsReady) await fontsReady;

    await waitForImages(clone);

    const rect = clone.getBoundingClientRect();
    const targetWidthPx = Math.ceil(rect.width);
    const fullWidthPx = Math.ceil(clone.scrollWidth || rect.width);

    // html2canvas is prone to 1–3px rounding errors on the right edge (especially with tables/inline text).
    // Add a small safety buffer so the last column never gets clipped.
    const safetyPx = captureFullWidth ? 6 : 0;
    if (captureFullWidth) {
      clone.style.paddingRight = `${safetyPx}px`;
    }

    const captureWidthPx =
      (captureFullWidth ? Math.max(targetWidthPx, fullWidthPx) : targetWidthPx) + safetyPx;

    return await html2canvas(clone, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor,
      width: captureWidthPx,
      windowWidth: captureWidthPx,
      scrollX: 0,
      scrollY: 0,
    });
  } finally {
    wrapper.remove();
  }
};
