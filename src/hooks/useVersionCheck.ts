import { useEffect, useState, useCallback } from 'react';
import { APP_VERSION } from '@/lib/version';

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
        cache: 'no-store',
      });

      if (!response.ok) return;

      const serverVersion: VersionInfo = await response.json();

      // Only prompt when the semantic app version changes.
      // (Build timestamps can differ in preview/dev environments and cause false positives.)
      const hasUpdate = !!serverVersion.version && serverVersion.version !== APP_VERSION;
      setIsUpdateAvailable(hasUpdate);

      // If the server version matches again, allow future prompts.
      if (!hasUpdate && isDismissed) {
        setIsDismissed(false);
      }
    } catch (error) {
      // Silently fail - version.json might not exist in development
      console.debug('Version check failed:', error);
    }
  }, [isDismissed]);

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
    refresh,
  };
};
