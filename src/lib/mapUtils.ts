/**
 * Utility functions for map initialization and WebGL detection
 */

/**
 * Check if WebGL is supported in the current browser
 */
export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const hasWebGL = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
    return hasWebGL;
  } catch (e) {
    console.warn('[mapUtils] WebGL detection failed:', e);
    return false;
  }
}

/**
 * Validate Mapbox token format
 */
export function isValidMapboxToken(token: string): boolean {
  // Mapbox tokens start with 'pk.' (public) or 'sk.' (secret)
  // They should be at least 50 characters
  return token.startsWith('pk.') && token.length > 50;
}

/**
 * Helper to escape HTML to prevent XSS in popups
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Curaçao map defaults
export const CURACAO_CENTER: [number, number] = [-68.99, 12.17];
export const CURACAO_BOUNDS: [[number, number], [number, number]] = [
  [-69.2, 12.0],
  [-68.7, 12.45]
];

// Loading timeout for maps (in milliseconds)
export const MAP_LOAD_TIMEOUT = 15000;
