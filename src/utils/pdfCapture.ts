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
    scale?: number;
    backgroundColor?: string;
  }
): Promise<HTMLCanvasElement> => {
  const { widthMm, scale = 2, backgroundColor = "#ffffff" } = opts;

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

  const clone = element.cloneNode(true) as HTMLElement;
  clone.setAttribute("data-pdf-capture-node", "true");
  clone.style.width = `${widthMm}mm`;
  clone.style.maxWidth = `${widthMm}mm`;
  clone.style.minWidth = `${widthMm}mm`;
  clone.style.boxSizing = "border-box";
  clone.style.margin = "0";
  clone.style.transform = "none";

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

    return await html2canvas(clone, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor,
      width: targetWidthPx,
      windowWidth: targetWidthPx,
      scrollX: 0,
      scrollY: 0,
    });
  } finally {
    wrapper.remove();
  }
};
