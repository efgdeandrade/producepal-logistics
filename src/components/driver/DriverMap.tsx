import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { MapLoadingState, WebGLError } from '@/components/maps/MapLoadingState';
import { isWebGLSupported, escapeHtml, MAP_LOAD_TIMEOUT } from '@/lib/mapUtils';

interface Order {
  id: string;
  order_number: string;
  distribution_customers: {
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

interface DriverMapProps {
  orders: Order[];
  driverLocation: { lat: number; lng: number } | null;
  selectedOrder: string | null;
  onSelectOrder: (orderId: string) => void;
}

export default function DriverMap({
  orders,
  driverLocation,
  selectedOrder,
  onSelectOrder,
}: DriverMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const orderMarkers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  
  const { token: mapToken } = useMapboxToken();

  // Check WebGL support once on mount
  useEffect(() => {
    if (!isWebGLSupported()) {
      setWebGLSupported(false);
      setIsLoading(false);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapToken || !webGLSupported) return;

    // Clean up existing map
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    setIsLoading(true);
    setError(null);
    setMapLoaded(false);

    try {
      mapboxgl.accessToken = mapToken;

      // Center on Curaçao
      const curacaoCenter: [number, number] = [-68.99, 12.17];

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: curacaoCenter,
        zoom: 11,
        attributionControl: false,
      });

      // Set up loading timeout
      const timeoutId = setTimeout(() => {
        if (!mapLoaded && map.current) {
          console.error('[DriverMap] Map load timeout');
          setError('Map is taking too long to load. Please check your connection.');
          setIsLoading(false);
        }
      }, MAP_LOAD_TIMEOUT);

      // Add navigation control
      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: false }),
        'top-right'
      );

      // Add geolocate control
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      });
      map.current.addControl(geolocate, 'top-right');

      map.current.on('load', () => {
        clearTimeout(timeoutId);
        console.log('[DriverMap] Map loaded successfully');
        setMapLoaded(true);
        setIsLoading(false);
        setError(null);
      });

      map.current.on('error', (e) => {
        console.error('[DriverMap] Mapbox error:', e);
        clearTimeout(timeoutId);
        setError('Map failed to load. Please try again.');
        setIsLoading(false);
      });
    } catch (err) {
      console.error('[DriverMap] Initialization error:', err);
      setError('Failed to initialize map. Please refresh the page.');
      setIsLoading(false);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapToken, webGLSupported, retryCount]);

  // Retry handler
  const handleRetry = useCallback(() => {
    console.log('[DriverMap] Retrying map initialization...');
    setRetryCount((prev) => prev + 1);
  }, []);

  // Update driver marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !driverLocation) return;

    if (!driverMarker.current) {
      // Create driver marker with pulsing dot
      const el = document.createElement('div');
      el.className = 'driver-marker';
      el.innerHTML = `
        <div class="relative">
          <div class="absolute inset-0 w-8 h-8 bg-blue-500 rounded-full animate-ping opacity-75"></div>
          <div class="relative w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
        </div>
      `;

      driverMarker.current = new mapboxgl.Marker(el)
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(map.current);
    } else {
      driverMarker.current.setLngLat([driverLocation.lng, driverLocation.lat]);
    }
  }, [driverLocation, mapLoaded]);

  // Update order markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    orderMarkers.current.forEach(marker => marker.remove());
    orderMarkers.current.clear();

    // Add new markers
    orders.forEach((order, index) => {
      const customer = order.distribution_customers;
      if (!customer?.latitude || !customer?.longitude) return;

      const isSelected = order.id === selectedOrder;

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'order-marker cursor-pointer';
      el.innerHTML = `
        <div class="relative transform transition-transform ${isSelected ? 'scale-125' : ''}">
          <div class="w-10 h-10 ${isSelected ? 'bg-primary' : 'bg-orange-500'} rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-sm">
            ${index + 1}
          </div>
          ${isSelected ? `
            <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 
              border-l-[8px] border-l-transparent 
              border-r-[8px] border-r-transparent 
              border-t-[8px] border-t-primary">
            </div>
          ` : ''}
        </div>
      `;

      el.addEventListener('click', () => onSelectOrder(order.id));

      const marker = new mapboxgl.Marker(el)
        .setLngLat([customer.longitude, customer.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false })
            .setHTML(`
              <div class="p-2">
                <p class="font-semibold">${escapeHtml(customer.name)}</p>
                <p class="text-sm text-gray-600">${escapeHtml(customer.address || 'No address')}</p>
              </div>
            `)
        )
        .addTo(map.current!);

      orderMarkers.current.set(order.id, marker);
    });

    // Fit bounds to show all markers
    if (orders.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      
      orders.forEach(order => {
        const customer = order.distribution_customers;
        if (customer?.latitude && customer?.longitude) {
          bounds.extend([customer.longitude, customer.latitude]);
        }
      });

      if (driverLocation) {
        bounds.extend([driverLocation.lng, driverLocation.lat]);
      }

      if (!bounds.isEmpty()) {
        map.current?.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 14,
        });
      }
    }
  }, [orders, selectedOrder, driverLocation, onSelectOrder, mapLoaded]);

  // Center on selected order
  useEffect(() => {
    if (!map.current || !mapLoaded || !selectedOrder) return;

    const order = orders.find(o => o.id === selectedOrder);
    const customer = order?.distribution_customers;
    
    if (customer?.latitude && customer?.longitude) {
      map.current.flyTo({
        center: [customer.longitude, customer.latitude],
        zoom: 15,
        duration: 1000,
      });

      // Show popup
      const marker = orderMarkers.current.get(selectedOrder);
      if (marker) {
        marker.togglePopup();
      }
    }
  }, [selectedOrder, orders, mapLoaded]);

  // Show WebGL error if not supported
  if (!webGLSupported) {
    return (
      <div className="relative h-full w-full">
        <WebGLError />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />
      <MapLoadingState 
        isLoading={isLoading} 
        error={error} 
        onRetry={handleRetry}
      />
    </div>
  );
}
