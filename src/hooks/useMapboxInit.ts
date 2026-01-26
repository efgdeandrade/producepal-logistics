import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMapboxToken } from './useMapboxToken';
import { isWebGLSupported, isValidMapboxToken, MAP_LOAD_TIMEOUT } from '@/lib/mapUtils';

export interface MapInitOptions {
  center?: [number, number];
  zoom?: number;
  style?: string;
  maxBounds?: [[number, number], [number, number]];
  attributionControl?: boolean;
}

export interface UseMapboxInitResult {
  map: mapboxgl.Map | null;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  webGLSupported: boolean;
  retry: () => void;
}

const DEFAULT_OPTIONS: MapInitOptions = {
  center: [-68.99, 12.17], // Curaçao
  zoom: 11,
  style: 'mapbox://styles/mapbox/streets-v12',
  attributionControl: false,
};

export function useMapboxInit(
  containerRef: React.RefObject<HTMLDivElement>,
  options: MapInitOptions = {}
): UseMapboxInitResult {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [webGLSupported, setWebGLSupported] = useState(true);
  
  const { token } = useMapboxToken();

  const cleanup = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    setIsReady(false);
  }, []);

  const initializeMap = useCallback(() => {
    if (!containerRef.current || !token) {
      return;
    }

    // Check WebGL support first
    if (!isWebGLSupported()) {
      console.error('[useMapboxInit] WebGL not supported');
      setWebGLSupported(false);
      setIsLoading(false);
      setError('WebGL is not supported on this device');
      return;
    }

    // Validate token format
    if (!isValidMapboxToken(token)) {
      console.error('[useMapboxInit] Invalid token format');
      setError('Invalid map configuration. Please contact support.');
      setIsLoading(false);
      return;
    }

    // Clean up any existing map
    cleanup();

    setIsLoading(true);
    setError(null);

    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    try {
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: mergedOptions.style,
        center: mergedOptions.center,
        zoom: mergedOptions.zoom,
        maxBounds: mergedOptions.maxBounds,
        attributionControl: mergedOptions.attributionControl,
      });

      mapRef.current = map;

      // Set up loading timeout
      const timeoutId = setTimeout(() => {
        if (!isReady && mapRef.current) {
          console.error('[useMapboxInit] Map load timeout');
          setError('Map is taking too long to load. Please check your connection.');
          setIsLoading(false);
        }
      }, MAP_LOAD_TIMEOUT);

      // Handle successful load
      map.on('load', () => {
        clearTimeout(timeoutId);
        console.log('[useMapboxInit] Map loaded successfully');
        setIsReady(true);
        setIsLoading(false);
        setError(null);
      });

      // Handle errors
      map.on('error', (e) => {
        console.error('[useMapboxInit] Mapbox error:', e);
        clearTimeout(timeoutId);
        
        // Check for specific error types
        const errorMessage = e.error?.message || 'Map failed to load';
        
        if (errorMessage.includes('access token')) {
          setError('Map authentication failed. Please refresh the page.');
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          setError('Network error. Please check your internet connection.');
        } else {
          setError('Map failed to load. Please try again.');
        }
        
        setIsLoading(false);
      });

      // Add navigation controls
      map.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: false }),
        'top-right'
      );

    } catch (err) {
      console.error('[useMapboxInit] Initialization error:', err);
      setError('Failed to initialize map. Please refresh the page.');
      setIsLoading(false);
    }
  }, [containerRef, token, options, cleanup, isReady]);

  // Initialize on mount and when dependencies change
  useEffect(() => {
    if (containerRef.current && token) {
      initializeMap();
    }

    return cleanup;
  }, [token, retryCount]); // Re-initialize on retry

  // Retry function
  const retry = useCallback(() => {
    console.log('[useMapboxInit] Retrying map initialization...');
    setRetryCount((prev) => prev + 1);
  }, []);

  return {
    map: mapRef.current,
    isLoading,
    isReady,
    error,
    webGLSupported,
    retry,
  };
}
