import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Fallback token (public tokens are safe to expose - they have domain restrictions)
const FALLBACK_TOKEN = "pk.eyJ1IjoiZnVpayIsImEiOiJjbWppanJ1NmgxczhlM2VvdHVvYWdrdTk4In0.PMmNjfuH2z3Rg26Idf0mjg";

// Global cache - persists across component mounts
let cachedToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

export function useMapboxToken() {
  const [token, setToken] = useState<string>(cachedToken || FALLBACK_TOKEN);
  const [isLoading, setIsLoading] = useState(!cachedToken);
  const [error, setError] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // If we have a cached token from edge function, use it immediately
    if (cachedToken && cachedToken !== FALLBACK_TOKEN) {
      setToken(cachedToken);
      setIsLoading(false);
      return;
    }

    // Use fallback immediately for instant map load
    setToken(FALLBACK_TOKEN);
    setIsLoading(false);

    // Try to fetch from edge function in background (with timeout)
    const fetchToken = async () => {
      // Reuse existing promise if already fetching
      if (tokenPromise) {
        try {
          const fetchedToken = await tokenPromise;
          setToken(fetchedToken);
        } catch {
          // Already handled in the promise
        }
        return;
      }
      
      tokenPromise = new Promise<string>(async (resolve) => {
        try {
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
          
          const { data, error } = await supabase.functions.invoke('get-mapbox-token');
          clearTimeout(timeoutId);
          
          if (!error && data?.token) {
            console.log('[useMapboxToken] Token fetched from edge function');
            cachedToken = data.token;
            resolve(data.token);
          } else {
            console.log('[useMapboxToken] Using fallback token, edge function returned:', error?.message || 'no token');
            cachedToken = FALLBACK_TOKEN;
            resolve(FALLBACK_TOKEN);
          }
        } catch (err) {
          console.log('[useMapboxToken] Fetch failed, using fallback:', err);
          cachedToken = FALLBACK_TOKEN;
          setHasError(true);
          resolve(FALLBACK_TOKEN);
        } finally {
          // Reset promise after completion so future calls can retry
          setTimeout(() => {
            tokenPromise = null;
          }, 60000); // Cache for 60 seconds before allowing retry
        }
      });
      
      const fetchedToken = await tokenPromise;
      setToken(fetchedToken);
    };

    fetchToken();
  }, []);

  return { token, isLoading, error, hasError };
}
