/**
 * DOM helpers for reliable PDF/print capture.
 */

/**
 * Waits for all images inside an element to finish loading.
 * Resolves on load OR error OR timeout per image to avoid hanging.
 */
export const waitForImages = async (element: HTMLElement, timeout = 5000): Promise<void> => {
  const images = element.querySelectorAll('img');
  const loadPromises = Array.from(images).map((img) => {
    // Already loaded successfully
    if (img.complete && img.naturalHeight !== 0) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const timeoutId = window.setTimeout(resolve, timeout);
      img.onload = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
      img.onerror = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
    });
  });

  await Promise.all(loadPromises);
};
