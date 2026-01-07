import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, History, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/production', label: 'Dashboard', icon: Home },
  { path: '/production/input', label: 'Input', icon: ClipboardList, highlight: true },
  { path: '/production/dashboard', label: 'History', icon: History },
  { path: '/distribution/settings', label: 'Settings', icon: Settings },
];

export function ProductionNav() {
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
                item.highlight && !isActive && "relative",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.highlight && !isActive ? (
                <div className="absolute -top-3 w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
              ) : (
                <Icon className={cn("h-6 w-6", isActive && "scale-110")} />
              )}
              <span className={cn(
                "text-xs mt-1",
                item.highlight && !isActive && "mt-5"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
