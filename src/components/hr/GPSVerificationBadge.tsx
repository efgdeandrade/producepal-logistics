import { Badge } from "../ui/badge";
import { MapPin, MapPinOff, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";

interface GPSVerificationBadgeProps {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  timestamp?: string | null;
}

export function GPSVerificationBadge({
  latitude,
  longitude,
  accuracy,
  timestamp,
}: GPSVerificationBadgeProps) {
  const hasLocation = latitude !== null && longitude !== null;
  const isAccurate = accuracy !== null && accuracy <= 100; // Within 100 meters

  if (!hasLocation) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="secondary" className="gap-1">
            <MapPinOff className="h-3 w-3" />
            No GPS
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Location not captured</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!isAccurate) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
            <AlertTriangle className="h-3 w-3" />
            Low Accuracy
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>GPS accuracy: {accuracy?.toFixed(0)}m</p>
          <p className="text-xs text-muted-foreground">
            {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
          <MapPin className="h-3 w-3" />
          Verified
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>GPS verified (±{accuracy?.toFixed(0)}m)</p>
        <p className="text-xs text-muted-foreground">
          {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
        </p>
        {timestamp && (
          <p className="text-xs text-muted-foreground">
            {new Date(timestamp).toLocaleTimeString()}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
