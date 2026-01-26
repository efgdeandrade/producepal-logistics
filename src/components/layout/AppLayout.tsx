import { ReactNode, useState, useEffect } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useLocation } from "react-router-dom";
import { nowCuracao, formatCuracao, weekNumberCuracao } from "@/lib/dateUtils";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

// Map routes to breadcrumb labels
const routeLabels: Record<string, string> = {
  "": "Home",
  import: "Import",
  distribution: "Distribution",
  logistics: "Logistics",
  production: "Production",
  hr: "HR & Team",
  settings: "Settings",
  users: "User Management",
  orders: "Orders",
  new: "New",
  edit: "Edit",
  cif: "CIF Calculator",
  history: "History",
  suppliers: "Suppliers",
  products: "Products",
  customers: "Customers",
  consolidation: "Consolidation",
  picker: "Picker Station",
  supervisor: "Supervisor",
  weekly: "Weekly Board",
  "standing-orders": "Standing Orders",
  pricing: "Pricing Tiers",
  zones: "Zones",
  cod: "COD Reconciliation",
  analytics: "Analytics",
  receipts: "Receipt Verification",
  dispatch: "Dispatch Center",
  routes: "Routes",
  schedule: "Driver Schedule",
  "driver-zones": "Driver Zones",
  deliveries: "Deliveries",
  invoices: "Invoices",
  "driver-portal": "Driver Portal",
  input: "Input",
  employees: "Employees",
  attendance: "Time & Attendance",
  documents: "Documents",
};

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(nowCuracao());
  const isMobile = useIsMobile();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(nowCuracao()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Generate breadcrumbs from current path
  const pathSegments = location.pathname.split("/").filter(Boolean);
  
  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = "/" + pathSegments.slice(0, index + 1).join("/");
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    const isLast = index === pathSegments.length - 1;
    
    return { path, label, isLast };
  });

  // On mobile, render without sidebar
  if (isMobile) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-background">
        {/* Mobile header - simpler */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 safe-area-top">
          {/* Current page title */}
          <h1 className="font-semibold text-lg flex-1 truncate">
            {breadcrumbs[breadcrumbs.length - 1]?.label || "Dashboard"}
          </h1>

          {/* Time + Notifications */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              {formatCuracao(currentTime, 'HH:mm')}
            </span>
            <NotificationCenter />
            <OfflineIndicator />
          </div>
        </header>

        {/* Main content with bottom nav padding */}
        <main className="flex-1 p-4 pt-2 pb-24">
          {children}
        </main>
      </div>
    );
  }

  // Desktop: Full sidebar layout
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          {/* Compact header with breadcrumb */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-6" />
            
            <Breadcrumb className="flex">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((crumb, index) => (
                  <BreadcrumbItem key={crumb.path}>
                    <BreadcrumbSeparator />
                    {crumb.isLast ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={crumb.path}>{crumb.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            {/* Time/Date/Week Display + Notifications */}
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="flex flex-col text-right">
              <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-xs sm:text-sm font-medium text-foreground">
                    {formatCuracao(currentTime, 'MMM d')}
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground font-mono">
                    {formatCuracao(currentTime, 'HH:mm')}
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  Week {weekNumberCuracao()}
                </span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <NotificationCenter />
              <OfflineIndicator />
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 p-4 lg:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
