import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { LogisticsNav } from '@/components/portals/LogisticsNav';
import { PortalSidebar, PortalNavItem } from '@/components/layout/PortalSidebar';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { HeaderClock } from '@/components/layout/HeaderClock';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { 
  Truck, 
  Home, 
  MapPin,
  Wallet,
  Calendar,
  Map,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LogisticsLayoutProps {
  children: ReactNode;
}

const logisticsNavItems: PortalNavItem[] = [
  { path: '/logistics', label: 'Dashboard', icon: Home },
  { path: '/logistics/dispatch', label: 'Dispatch', icon: MapPin },
  { path: '/logistics/schedule', label: 'Driver Schedule', icon: Calendar },
  { path: '/logistics/driver-portal', label: 'Driver Wallet', icon: Wallet },
  { path: '/logistics/driver-zones', label: 'Driver Zones', icon: Map },
];

export function LogisticsLayout({ children }: LogisticsLayoutProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Mobile Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top">
          <div className="flex h-14 items-center px-4 gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <Link to="/select-portal">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Truck className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold">Logistics</span>
            </div>
            <div className="flex-1" />
            <HeaderClock />
            <OfflineIndicator />
            <NotificationCenter />
          </div>
        </header>

        {/* Mobile Main Content */}
        <main className="flex-1 pb-20 p-4">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <LogisticsNav />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <PortalSidebar
          portalName="Logistics"
          portalPath="/logistics"
          portalIcon={
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
          }
          navItems={logisticsNavItems}
        />
        
        <SidebarInset className="flex-1">
          {/* Desktop Header */}
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4 gap-4">
              <SidebarTrigger />
              <div className="flex-1" />
              <HeaderClock />
              <OfflineIndicator />
              <NotificationCenter />
            </div>
          </header>

          {/* Desktop Main Content */}
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
