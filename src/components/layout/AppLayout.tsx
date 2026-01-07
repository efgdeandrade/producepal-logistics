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
import { format, getWeek } from "date-fns";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { OfflineIndicator } from "@/components/OfflineIndicator";

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
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
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

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          {/* Compact header with breadcrumb */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
            <SidebarTrigger className="-ml-1 md:hidden" />
            <Separator orientation="vertical" className="h-6 md:hidden" />
            
            <Breadcrumb className="hidden md:flex">
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

            {/* Mobile: Show current page title */}
            <div className="md:hidden">
              <span className="font-medium">
                {breadcrumbs[breadcrumbs.length - 1]?.label || "Dashboard"}
              </span>
            </div>

            {/* Time/Date/Week Display + Notifications */}
            <div className="ml-auto flex items-center gap-3">
              <div className="flex flex-col text-right">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {format(currentTime, 'MMM do')}
                  </span>
                  <span className="text-sm text-muted-foreground font-mono">
                    {format(currentTime, 'HH:mm')}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Week {getWeek(currentTime)}
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
