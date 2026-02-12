import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { ImportNav } from '@/components/portals/ImportNav';
import { PortalSidebar, PortalNavItem } from '@/components/layout/PortalSidebar';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { HeaderClock } from '@/components/layout/HeaderClock';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { 
  Ship, 
  Home, 
  ShoppingCart, 
  Calculator,
  Package,
  Building2,
  History,
  ArrowLeft,
  Mail,
  FileText,
  Users,
  Layers,
  FileSpreadsheet,
  Receipt,
  Truck,
  FolderOpen,
  BarChart3,
  Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImportLayoutProps {
  children: ReactNode;
}

const importNavItems: PortalNavItem[] = [
  { path: '/import', label: 'Dashboard', icon: Home },
  { path: '/import/orders', label: 'Orders', icon: ShoppingCart },
  { path: '/import/customers', label: 'Customers', icon: Users },
  { path: '/import/products', label: 'Products', icon: Package },
  { path: '/import/suppliers', label: 'Suppliers', icon: Building2 },
  { path: '/import/consolidation-groups', label: 'Consolidation Groups', icon: Layers },
  { path: '/import/cif-calculator', label: 'CIF Calculator', icon: Calculator },
  { path: '/import/cif-reports', label: 'CIF Reports', icon: BarChart3 },
  { path: '/import/invoices', label: 'Invoices', icon: FileSpreadsheet },
  { path: '/import/bills', label: 'Bills/Expenses', icon: Receipt },
  { path: '/import/shipments', label: 'Shipment Tracking', icon: Truck },
  { path: '/import/documents', label: 'Documents', icon: FolderOpen },
  { path: '/import/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/import/standing-orders', label: 'Order Templates', icon: FileText },
  { path: '/import/email-templates', label: 'Email Templates', icon: Mail },
  { path: '/import/ai-learning', label: 'AI Learning', icon: Brain },
];

export function ImportLayout({ children }: ImportLayoutProps) {
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
                <Ship className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold">Import</span>
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
        <ImportNav />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <PortalSidebar
          portalName="Import"
          portalPath="/import"
          portalIcon={
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Ship className="h-5 w-5 text-primary-foreground" />
            </div>
          }
          navItems={importNavItems}
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
