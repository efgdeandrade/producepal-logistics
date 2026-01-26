
# Fix Unreliable Map Loading

## Problem Summary
Maps intermittently fail to load, showing infinite spinner with no error feedback. Users cannot interact with map-based features like Driver Mobile, Dispatch, Zone Management, and Customer Location Picker.

## Root Causes Identified

1. **No Error Handling**: Map components don't listen for Mapbox `error` events
2. **No Loading Timeout**: If map hangs, users wait forever with no feedback
3. **No WebGL Check**: Devices without WebGL support see blank maps
4. **Silent Failures**: Token/network errors don't show user-friendly messages
5. **No Retry Mechanism**: Single failure = permanent broken state

## Solution: Create a Robust Map Wrapper Component

Create a centralized `MapContainer` component that handles all loading/error states consistently across the app.

## Files to Create/Modify

### 1. NEW: `src/components/maps/MapContainer.tsx`
A reusable wrapper that provides:
- WebGL support detection before loading
- Loading spinner with timeout (15 seconds)
- Error state with retry button
- Proper Mapbox error event handling
- Consistent UI across all map components

```text
┌─────────────────────────────────┐
│ Loading State:                  │
│   ┌─────────────────────────┐   │
│   │  [Spinner]              │   │
│   │  Loading map...         │   │
│   │  (Shows for max 15s)    │   │
│   └─────────────────────────┘   │
│                                 │
│ Error State:                    │
│   ┌─────────────────────────┐   │
│   │  ⚠️ Map failed to load   │   │
│   │  [Retry] [Continue w/o]  │   │
│   └─────────────────────────┘   │
│                                 │
│ Success State:                  │
│   ┌─────────────────────────┐   │
│   │  [Actual Mapbox Map]    │   │
│   └─────────────────────────┘   │
└─────────────────────────────────┘
```

### 2. NEW: `src/hooks/useMapboxInit.ts`
A hook that handles:
- Token retrieval with better error handling
- WebGL capability detection
- Map initialization with timeout
- Error state management
- Automatic retry logic (max 3 attempts)

Key features:
```typescript
interface UseMapboxInitResult {
  mapRef: React.RefObject<mapboxgl.Map | null>;
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
  retry: () => void;
}

export function useMapboxInit(
  containerRef: React.RefObject<HTMLDivElement>,
  options: MapInitOptions
): UseMapboxInitResult
```

### 3. MODIFY: `src/components/driver/DriverMap.tsx`
- Add Mapbox error event listener
- Add loading timeout (15 seconds)
- Show loading spinner during initialization
- Show error message with retry button if load fails
- Add WebGL check before initialization

Changes:
```typescript
// Add error handling
map.current.on("error", (e) => {
  console.error("[DriverMap] Mapbox error:", e);
  setError("Map failed to load. Please check your connection.");
});

// Add timeout
const timeout = setTimeout(() => {
  if (!mapLoaded) {
    setError("Map is taking too long to load.");
  }
}, 15000);
```

### 4. MODIFY: `src/components/fnb/ZoneMapView.tsx`
Same changes as DriverMap:
- Error event listener
- Loading timeout
- Error UI with retry

### 5. MODIFY: `src/pages/fnb/FnbDispatch.tsx`
Same pattern:
- Error handling
- Loading states
- Retry mechanism

### 6. MODIFY: `src/components/fnb/CustomerLocationPicker.tsx`
Same pattern for consistency

### 7. MODIFY: `src/hooks/useMapboxToken.ts`
Improve reliability:
- Add token validation (check if token format is valid)
- Better error logging
- Expose `hasError` state for components to react to

## Implementation Details

### WebGL Detection Utility
```typescript
function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}
```

### Loading Timeout Pattern
```typescript
useEffect(() => {
  const timeoutId = setTimeout(() => {
    if (!mapLoaded && !error) {
      setError('Map is taking too long to load. Please check your internet connection.');
    }
  }, 15000);
  
  return () => clearTimeout(timeoutId);
}, [mapLoaded, error]);
```

### Error UI Component
```tsx
{error && (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 backdrop-blur-sm">
    <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
    <p className="text-sm text-muted-foreground mb-4 text-center px-4">{error}</p>
    <Button onClick={handleRetry} variant="outline" size="sm">
      <RefreshCw className="h-4 w-4 mr-2" />
      Retry
    </Button>
  </div>
)}
```

### Loading UI Component
```tsx
{!mapLoaded && !error && (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50">
    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
    <p className="text-sm text-muted-foreground">Loading map...</p>
  </div>
)}
```

## Files to Modify Summary

| File | Changes |
|------|---------|
| `src/hooks/useMapboxToken.ts` | Add token validation, expose error state |
| `src/hooks/useMapboxInit.ts` | NEW - Centralized map initialization hook |
| `src/components/maps/MapContainer.tsx` | NEW - Reusable map wrapper with loading/error states |
| `src/components/driver/DriverMap.tsx` | Add error handling, loading timeout, retry |
| `src/components/fnb/ZoneMapView.tsx` | Add error handling, loading timeout, retry |
| `src/pages/fnb/FnbDispatch.tsx` | Add error handling, loading timeout, retry |
| `src/components/fnb/CustomerLocationPicker.tsx` | Add error handling, loading timeout, retry |
| `src/components/fnb/ZoneHierarchyMapView.tsx` | Add error handling, loading timeout, retry |
| `src/components/fnb/PolygonDrawingMap.tsx` | Add error handling, loading timeout, retry |
| `src/components/hr/AttendanceMap.tsx` | Add error handling, loading timeout, retry |

## Expected Outcome

After implementation:
- Users see clear loading indicator when map initializes
- If map fails, users see friendly error message with retry option
- WebGL-unsupported devices get informative message
- Network failures don't leave users stuck on spinner
- Automatic retry after transient failures
- Consistent experience across all 7 map components

## Additional Recommendations

1. **Verify Mapbox Token**: Log into Mapbox dashboard and verify the public token `pk.eyJ1I...` is still active and hasn't hit rate limits
2. **Check Domain Restrictions**: Ensure token allows requests from your production domain
3. **Add Monitoring**: Consider adding error logging to track map failures in production
