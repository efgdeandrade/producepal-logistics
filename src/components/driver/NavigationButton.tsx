import { useState } from 'react';
import { Button } from '../ui/button';
import { Navigation, ExternalLink } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface NavigationButtonProps {
  address: string | null;
  coordinates?: { lat: number; lng: number } | null;
  className?: string;
}

export default function NavigationButton({
  address,
  coordinates,
  className = '',
}: NavigationButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigation = (app: 'apple' | 'google' | 'waze') => {
    let url = '';
    
    if (coordinates) {
      switch (app) {
        case 'apple':
          url = `maps://maps.apple.com/?daddr=${coordinates.lat},${coordinates.lng}`;
          // Fallback for non-iOS devices
          if (!navigator.userAgent.includes('iPhone') && !navigator.userAgent.includes('iPad')) {
            url = `https://maps.apple.com/?daddr=${coordinates.lat},${coordinates.lng}`;
          }
          break;
        case 'google':
          url = `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`;
          break;
        case 'waze':
          url = `https://waze.com/ul?ll=${coordinates.lat},${coordinates.lng}&navigate=yes`;
          break;
      }
    } else if (address) {
      const encodedAddress = encodeURIComponent(address);
      switch (app) {
        case 'apple':
          url = `maps://maps.apple.com/?daddr=${encodedAddress}`;
          if (!navigator.userAgent.includes('iPhone') && !navigator.userAgent.includes('iPad')) {
            url = `https://maps.apple.com/?daddr=${encodedAddress}`;
          }
          break;
        case 'google':
          url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
          break;
        case 'waze':
          url = `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
          break;
      }
    }

    if (url) {
      window.open(url, '_blank');
    }
    setIsOpen(false);
  };

  // Default to Apple Maps on iPhone
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

  if (!address && !coordinates) {
    return (
      <Button variant="outline" disabled className={className}>
        <Navigation className="h-4 w-4 mr-2" />
        No Address
      </Button>
    );
  }

  // Quick navigation button - opens Apple Maps on iOS, Google Maps otherwise
  const handleQuickNav = () => {
    if (isIOS) {
      handleNavigation('apple');
    } else {
      handleNavigation('google');
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button 
        onClick={handleQuickNav}
        className="flex-1"
      >
        <Navigation className="h-4 w-4 mr-2" />
        Navigate
      </Button>
      
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleNavigation('apple')}>
            <span className="mr-2">🍎</span>
            Apple Maps
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigation('google')}>
            <span className="mr-2">🗺️</span>
            Google Maps
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigation('waze')}>
            <span className="mr-2">🚗</span>
            Waze
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
