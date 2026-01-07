import { Link, useLocation } from 'react-router-dom';
import { Truck, MapPin, Wallet, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/logistics', label: 'Deliveries', icon: Truck },
  { path: '/logistics/dispatch', label: 'Dispatch', icon: MapPin },
  { path: '/logistics/schedule', label: 'Schedule', icon: Calendar },
  { path: '/logistics/driver-portal', label: 'Wallet', icon: Wallet },
  { path: '/logistics/driver-zones', label: 'Zones', icon: User },
];

export function LogisticsNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center min-w-[64px] h-full px-3 transition-colors touch-manipulation",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-6 w-6", isActive && "scale-110")} />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
