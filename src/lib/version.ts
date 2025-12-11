// Version constants - update this when releasing new versions
export const APP_VERSION = '1.0.0';

// Build timestamp injected by Vite at build time
declare const __BUILD_TIMESTAMP__: string;
export const BUILD_TIMESTAMP = typeof __BUILD_TIMESTAMP__ !== 'undefined' 
  ? __BUILD_TIMESTAMP__ 
  : new Date().toISOString();

// Format build date for display
export const formatBuildDate = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Unknown';
  }
};

// Get version display string
export const getVersionDisplay = (): string => {
  return `v${APP_VERSION} • ${formatBuildDate(BUILD_TIMESTAMP)}`;
};
