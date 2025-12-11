import { useEffect, useState, useCallback } from 'react';
import { BUILD_TIMESTAMP } from '@/lib/version';

interface VersionInfo {
  version: string;
  buildTime: string;
}

interface UseVersionCheckResult {
  isUpdateAvailable: boolean;
  dismiss: () => void;
  refresh: () => void;
}

// Check interval: 5 minutes
const CHECK_INTERVAL = 5 * 60 * 1000;

export const useVersionCheck = (): UseVersionCheckResult => {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const checkVersion = useCallback(async () => {
    try {
      // Add cache-busting query param to prevent browser caching
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        return;
      }

      const serverVersion: VersionInfo = await response.json();
      
      // Compare build timestamps
      if (serverVersion.buildTime && serverVersion.buildTime !== BUILD_TIMESTAMP) {
        setIsUpdateAvailable(true);
      }
    } catch (error) {
      // Silently fail - version.json might not exist in development
      console.debug('Version check failed:', error);
    }
  }, []);

  useEffect(() => {
    // Initial check after a short delay (let the app load first)
    const initialTimeout = setTimeout(checkVersion, 10000);

    // Periodic checks
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkVersion]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  const refresh = useCallback(() => {
    // Force reload from server, bypassing cache
    window.location.reload();
  }, []);

  return {
    isUpdateAvailable: isUpdateAvailable && !isDismissed,
    dismiss,
    refresh
  };
};
