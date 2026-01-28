import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { DistributionNav } from '@/components/portals/DistributionNav';
import { PortalSidebar, PortalNavItem } from '@/components/layout/PortalSidebar';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { 
  Package, 
  Home, 
  ShoppingCart, 
  Users, 
  ClipboardPaste,
  Repeat,
  DollarSign,
  MapPin,
  Wallet,
  BarChart,
  Settings,
  ArrowLeft,
  Box,
  Calendar,
  Eye,
  Camera,
  GraduationCap,
  FileText,
  Mail,
  MessageSquare,
  Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DistributionLayoutProps {
  children: ReactNode;
}

const distributionNavItems: PortalNavItem[] = [
  { path: '/distribution', label: 'Dashboard', icon: Home },
  { path: '/distribution/orders/new', label: 'New Order', icon: ShoppingCart },
  { path: '/distribution/orders', label: 'All Orders', icon: ClipboardPaste },
  { path: '/distribution/whatsapp-inbox', label: 'Dre Inbox', icon: MessageSquare, showBadge: true },
  { path: '/distribution/dre-command-center', label: 'Dre Command Center', icon: Bot },
  { path: '/distribution/dre-analytics', label: 'Dre Analytics', icon: BarChart },
  { path: '/distribution/email-inbox', label: 'Email Inbox', icon: Mail, showBadge: true },
  { path: '/distribution/weekly', label: 'Weekly Board', icon: Calendar },
  { path: '/distribution/standing-orders', label: 'Standing Orders', icon: Repeat },
  { path: '/distribution/picker', label: 'Picker Station', icon: Box },
  { path: '/distribution/picker/supervisor', label: 'Picker Supervisor', icon: Eye },
  { path: '/distribution/receipts', label: 'Receipt Verification', icon: Camera },
  { path: '/distribution/invoices', label: 'Invoices', icon: FileText },
  { path: '/distribution/customers', label: 'Customers', icon: Users },
  { path: '/distribution/products', label: 'Products', icon: Box },
  { path: '/distribution/pricing', label: 'Pricing Tiers', icon: DollarSign },
  { path: '/distribution/zones', label: 'Zones', icon: MapPin },
  { path: '/distribution/cod', label: 'COD Reconciliation', icon: Wallet },
  { path: '/distribution/analytics', label: 'Analytics', icon: BarChart },
  { path: '/distribution/training', label: 'AI Training', icon: GraduationCap },
  { path: '/distribution/settings', label: 'Settings', icon: Settings },
];

export function DistributionLayout({ children }: DistributionLayoutProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen max-w-full bg-background flex flex-col overflow-x-hidden">
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
                <Package className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold">Distribution</span>
            </div>
            <div className="flex-1" />
            <OfflineIndicator />
            <NotificationCenter />
          </div>
        </header>

        {/* Mobile Main Content - prevent horizontal scroll */}
        <main className="flex-1 pb-20 overflow-x-hidden w-full">
          <div className="w-full max-w-full overflow-x-hidden">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <DistributionNav />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <PortalSidebar
          portalName="Distribution"
          portalPath="/distribution"
          portalIcon={
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
          }
          navItems={distributionNavItems}
        />
        
        <SidebarInset className="flex-1">
          {/* Desktop Header */}
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4 gap-4">
              <SidebarTrigger />
              <div className="flex-1" />
              <OfflineIndicator />
              <NotificationCenter />
            </div>
          </header>

          {/* Desktop Main Content */}
          <main className="flex-1">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
