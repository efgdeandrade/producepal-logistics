import { Loader2, AlertTriangle, RefreshCw, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MapLoadingStateProps {
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  className?: string;
}

export function MapLoadingState({
  isLoading,
  error,
  onRetry,
  className = "",
}: MapLoadingStateProps) {
  if (error) {
    return (
      <div className={`absolute inset-0 flex flex-col items-center justify-center bg-muted/90 backdrop-blur-sm z-10 ${className}`}>
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Map Failed to Load</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {error}
            </p>
          </div>
          {onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`absolute inset-0 flex flex-col items-center justify-center bg-muted/50 z-10 ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Loading map...</p>
        </div>
      </div>
    );
  }

  return null;
}

interface WebGLErrorProps {
  className?: string;
}

export function WebGLError({ className = "" }: WebGLErrorProps) {
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center bg-muted z-10 ${className}`}>
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="rounded-full bg-muted-foreground/10 p-4">
          <MapPinOff className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Map Not Supported</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Your device doesn't support WebGL, which is required for interactive maps.
            Try using a different browser or device.
          </p>
        </div>
      </div>
    </div>
  );
}
