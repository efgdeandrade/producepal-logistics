import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { LogisticsNav } from '@/components/portals/LogisticsNav';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LogisticsLayoutProps {
  children: ReactNode;
}

export function LogisticsLayout({ children }: LogisticsLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Mobile optimized */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top">
        <div className="flex h-14 items-center px-4 gap-4">
          <Link to="/logistics" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            {!isMobile && (
              <span className="font-semibold text-lg">Logistics</span>
            )}
          </Link>
          
          <div className="flex-1" />
          
          <OfflineIndicator />
          <NotificationCenter />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-6">
        {children}
      </main>

      {/* Bottom navigation - Mobile only */}
      {isMobile && <LogisticsNav />}
    </div>
  );
}
