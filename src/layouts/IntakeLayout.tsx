import { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, Mail, ShoppingBag, Package, Settings, Bot, ChevronLeft } from 'lucide-react';
import { AiOversightPanel } from '@/components/intake/AiOversightPanel';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Conversations', path: '/intake/conversations', icon: MessageSquare },
  { label: 'Email PO Inbox', path: '/intake/email-po', icon: Mail },
  { label: 'Shopify Orders', path: '/intake/shopify', icon: ShoppingBag },
  { label: 'Products', path: '/intake/products', icon: Package },
  { label: 'Settings', path: '/intake/settings', icon: Settings },
];

export function IntakeLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden bg-intake-bg">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 flex flex-col border-r border-border bg-intake-surface">
        {/* Back to Portal */}
        <button
          onClick={() => navigate('/select-portal')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full border-b border-border"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Portal
        </button>

        {/* Brand */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="FUIK" className="h-8" />
            <span className="font-semibold text-sm text-intake-text">Order Intake</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-intake-brand text-white'
                    : 'text-intake-text hover:bg-intake-brand-light'
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* AI Oversight Panel pinned at bottom */}
        <AiOversightPanel />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
