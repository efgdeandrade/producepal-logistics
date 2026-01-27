import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, ClipboardPaste, FileText, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWhatsAppUnreadCount } from '@/hooks/useWhatsAppMessages';

const navItems = [
  { path: '/distribution', label: 'Home', icon: Home },
  { path: '/distribution/orders', label: 'Orders', icon: ShoppingCart },
  { path: '/quick-paste', label: 'Quick', icon: ClipboardPaste, highlight: true },
  { path: '/distribution/whatsapp-inbox', label: 'Dre', icon: MessageSquare, showBadge: true },
  { path: '/distribution/invoices', label: 'Invoices', icon: FileText },
];

export function DistributionNav() {
  const location = useLocation();
  const unreadCount = useWhatsAppUnreadCount();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const showBadge = item.showBadge && unreadCount > 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center min-w-[64px] h-full px-3 transition-colors touch-manipulation relative",
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
                <div className="relative">
                  <Icon className={cn("h-6 w-6", isActive && "scale-110")} />
                  {showBadge && (
                    <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
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
