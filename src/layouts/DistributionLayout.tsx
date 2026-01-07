import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { DistributionNav } from '@/components/portals/DistributionNav';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { Package } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DistributionLayoutProps {
  children: ReactNode;
}

export function DistributionLayout({ children }: DistributionLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Mobile optimized */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top">
        <div className="flex h-14 items-center px-4 gap-4">
          <Link to="/distribution" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            {!isMobile && (
              <span className="font-semibold text-lg">Distribution</span>
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
      {isMobile && <DistributionNav />}
    </div>
  );
}
