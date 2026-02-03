import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Package, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/import', label: 'Dashboard', icon: Home },
  { path: '/import/orders', label: 'Orders', icon: ShoppingCart },
  { path: '/import/standing-orders', label: 'Templates', icon: FileText },
  { path: '/import/products', label: 'Products', icon: Package },
];

export function ImportNav() {
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
              <span className="text-xs mt-1">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}