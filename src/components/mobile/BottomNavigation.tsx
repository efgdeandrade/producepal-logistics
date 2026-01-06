import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, ClipboardList, User, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { path: '/fnb', label: 'Home', icon: Home },
  { path: '/fnb/orders', label: 'Orders', icon: ShoppingCart },
  { path: '/fnb/picker', label: 'Picker', icon: ClipboardList },
  { path: '/fnb/driver-mobile', label: 'Deliver', icon: Truck },
  { path: '/fnb/settings', label: 'Profile', icon: User },
];

export const BottomNavigation = () => {
  const location = useLocation();
  const isMobile = useIsMobile();

  // Only show on mobile and F&B routes
  if (!isMobile || !location.pathname.startsWith('/fnb')) {
    return null;
  }

  // Don't show on driver mobile page (has its own navigation)
  if (location.pathname === '/fnb/driver-mobile') {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1 text-xs transition-colors touch-manipulation',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span className={cn('font-medium', isActive && 'text-primary')}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
