import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, ClipboardList, Truck, MoreHorizontal, Package, Store, History, Calculator, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Get navigation items based on current section
const getNavItems = (pathname: string): NavItem[] => {
  // Distribution/F&B section
  if (pathname.startsWith('/distribution') || pathname.startsWith('/fnb')) {
    return [
      { path: '/distribution', label: 'Home', icon: Home },
      { path: '/distribution/orders', label: 'Orders', icon: ShoppingCart },
      { path: '/distribution/picker', label: 'Picker', icon: ClipboardList },
      { path: '/distribution/customers', label: 'Customers', icon: Users },
      { path: '/distribution/settings', label: 'More', icon: MoreHorizontal },
    ];
  }

  // Import section
  if (pathname.startsWith('/import')) {
    return [
      { path: '/import', label: 'Dashboard', icon: Home },
      { path: '/import/orders/new', label: 'New', icon: ShoppingCart },
      { path: '/import/orders', label: 'History', icon: History },
      { path: '/import/cif', label: 'CIF', icon: Calculator },
      { path: '/import/products', label: 'More', icon: MoreHorizontal },
    ];
  }

  // Logistics section
  if (pathname.startsWith('/logistics')) {
    return [
      { path: '/logistics', label: 'Dashboard', icon: Home },
      { path: '/logistics/dispatch', label: 'Dispatch', icon: Truck },
      { path: '/logistics/routes', label: 'Routes', icon: ClipboardList },
      { path: '/logistics/deliveries', label: 'Deliveries', icon: Package },
      { path: '/logistics/schedule', label: 'More', icon: MoreHorizontal },
    ];
  }

  // Production section
  if (pathname.startsWith('/production')) {
    return [
      { path: '/production', label: 'Dashboard', icon: Home },
      { path: '/production/input', label: 'Input', icon: ClipboardList },
      { path: '/production/dashboard', label: 'Legacy', icon: History },
      { path: '/', label: 'More', icon: MoreHorizontal },
    ];
  }

  // HR section
  if (pathname.startsWith('/hr')) {
    return [
      { path: '/hr', label: 'Dashboard', icon: Home },
      { path: '/hr/employees', label: 'Staff', icon: Users },
      { path: '/hr/attendance', label: 'Clock', icon: ClipboardList },
      { path: '/hr/timesheets', label: 'Sheets', icon: History },
      { path: '/hr/documents', label: 'More', icon: MoreHorizontal },
    ];
  }

  // Default navigation (main sections)
  return [
    { path: '/', label: 'Home', icon: Home },
    { path: '/distribution', label: 'Dist.', icon: Store },
    { path: '/import', label: 'Import', icon: Package },
    { path: '/logistics', label: 'Logistics', icon: Truck },
    { path: '/settings', label: 'More', icon: MoreHorizontal },
  ];
};

// Routes where bottom navigation should be hidden
const hiddenRoutes = [
  '/auth',
  '/install',
  '/offline',
  '/logistics/driver-mobile',
  '/fnb/driver-mobile',
];

export const BottomNavigation = () => {
  const location = useLocation();
  const isMobile = useIsMobile();

  // Only show on mobile
  if (!isMobile) {
    return null;
  }

  // Hide on specific routes
  if (hiddenRoutes.some(route => location.pathname.startsWith(route))) {
    return null;
  }

  const navItems = getNavItems(location.pathname);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1 text-xs transition-colors touch-manipulation min-h-[44px]',
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
