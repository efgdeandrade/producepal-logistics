import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Package,
  ShoppingCart,
  FileText,
  Users,
  Truck,
  Factory,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  Calculator,
  History,
  ClipboardList,
  MapPin,
  Route,
  Calendar,
  Receipt,
  BarChart3,
  UserCog,
  Clock,
  FileCheck,
  Store,
  Boxes,
  DollarSign,
  Eye,
  Loader2,
  FileBarChart,
  CalendarClock,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  role?: string;
}

interface MenuSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  role?: string;
  items: MenuItem[];
  defaultOpen?: boolean;
}

// Collapsed footer with dropdown menu
function CollapsedFooter({ 
  getInitials, 
  userEmail, 
  onSignOut, 
  signingOut 
}: { 
  getInitials: () => string; 
  userEmail?: string; 
  onSignOut: () => void; 
  signingOut: boolean;
}) {
  const { theme, setTheme } = useTheme();
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-full h-10">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-48">
        <DropdownMenuItem disabled className="text-xs opacity-70">
          {userEmail}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
          Toggle Theme
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSignOut} disabled={signingOut}>
          <LogOut className="h-4 w-4 mr-2" />
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isAdmin } = useAuth();
  const { canView } = usePermissions();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  const [signingOut, setSigningOut] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isInSection = (basePath: string) => location.pathname.startsWith(basePath);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  const getInitials = () => {
    if (!user?.email) return "U";
    return user.email.substring(0, 2).toUpperCase();
  };

  // Define menu structure
  const menuSections: MenuSection[] = [
    {
      title: "Import",
      icon: Package,
      permission: "orders",
      defaultOpen: isInSection("/import"),
      items: [
        { title: "Dashboard", url: "/import", icon: LayoutDashboard },
        { title: "New Order", url: "/import/orders/new", icon: ShoppingCart },
        { title: "Order History", url: "/import/orders", icon: History },
        { title: "Standing Orders", url: "/import/standing-orders", icon: ClipboardList },
        { title: "CIF Calculator", url: "/import/cif", icon: Calculator },
        { title: "CIF History", url: "/import/cif/history", icon: FileText },
        { title: "Suppliers", url: "/import/suppliers", icon: Building2 },
        { title: "Products", url: "/import/products", icon: Boxes },
        { title: "Customers", url: "/import/customers", icon: Users },
        { title: "Consolidation", url: "/import/consolidation", icon: Boxes },
      ],
    },
    {
      title: "Distribution",
      icon: Store,
      permission: "orders",
      defaultOpen: isInSection("/distribution"),
      items: [
        { title: "Dashboard", url: "/distribution", icon: LayoutDashboard },
        { title: "New Order", url: "/distribution/orders/new", icon: ShoppingCart },
        { title: "All Orders", url: "/distribution/orders", icon: ClipboardList },
        { title: "Weekly Board", url: "/distribution/weekly", icon: Calendar },
        { title: "Standing Orders", url: "/distribution/standing-orders", icon: ClipboardList },
        { title: "Picker Station", url: "/distribution/picker", icon: Package },
        { title: "Picker Supervisor", url: "/distribution/picker/supervisor", icon: Eye },
        { title: "Receipt Verification", url: "/distribution/receipts", icon: Receipt },
        { title: "Customers", url: "/distribution/customers", icon: Users },
        { title: "Products", url: "/distribution/products", icon: Boxes },
        { title: "Pricing Tiers", url: "/distribution/pricing", icon: DollarSign },
        { title: "Zones", url: "/distribution/zones", icon: MapPin },
        { title: "COD Reconciliation", url: "/distribution/cod", icon: DollarSign },
        { title: "Analytics", url: "/distribution/analytics", icon: BarChart3 },
        { title: "Settings", url: "/distribution/settings", icon: Settings },
      ],
    },
    {
      title: "Logistics",
      icon: Truck,
      permission: "logistics",
      defaultOpen: isInSection("/logistics"),
      items: [
        { title: "Dashboard", url: "/logistics", icon: LayoutDashboard },
        { title: "Dispatch Center", url: "/logistics/dispatch", icon: MapPin },
        { title: "Route Planning", url: "/logistics/routes", icon: Route },
        { title: "Driver Schedule", url: "/logistics/schedule", icon: Calendar },
        { title: "Driver Zones", url: "/logistics/driver-zones", icon: MapPin },
        { title: "Deliveries", url: "/logistics/deliveries", icon: Truck },
        { title: "Invoices", url: "/logistics/invoices", icon: FileText },
        { title: "Driver Portal", url: "/logistics/driver-portal", icon: Truck, role: "driver" },
      ],
    },
    {
      title: "Production",
      icon: Factory,
      permission: "production",
      defaultOpen: isInSection("/production"),
      items: [
        { title: "Dashboard", url: "/production", icon: LayoutDashboard },
        { title: "Production Input", url: "/production/input", icon: ClipboardList },
      ],
    },
    {
      title: "HR & Team",
      icon: UserCog,
      permission: "users",
      defaultOpen: isInSection("/hr"),
      items: [
        { title: "Dashboard", url: "/hr", icon: LayoutDashboard },
        { title: "Employees", url: "/hr/employees", icon: Users },
        { title: "Time & Attendance", url: "/hr/attendance", icon: Clock },
        { title: "Timesheets", url: "/hr/timesheets", icon: FileText },
        { title: "Documents", url: "/hr/documents", icon: FileCheck },
      ],
    },
  ];

  const renderMenuItem = (item: MenuItem) => {
    if (item.role && !isAdmin() && item.role !== "driver") return null;
    
    return (
      <SidebarMenuSubItem key={item.url}>
        <SidebarMenuSubButton
          asChild
          isActive={isActive(item.url)}
        >
          <a
            href={item.url}
            onClick={(e) => {
              e.preventDefault();
              navigate(item.url);
            }}
            className="flex items-center gap-2"
          >
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </a>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  };

  const renderSection = (section: MenuSection) => {
    if (section.permission && !canView(section.permission) && !isAdmin()) return null;

    return (
      <Collapsible
        key={section.title}
        defaultOpen={section.defaultOpen}
        className="group/collapsible"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={section.title}
              className="w-full justify-between"
            >
              <div className="flex items-center gap-2">
                <section.icon className="h-4 w-4" />
                {!collapsed && <span className="font-medium">{section.title}</span>}
              </div>
              {!collapsed && (
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              )}
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {section.items.map(renderMenuItem)}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          className="flex items-center justify-center gap-2"
        >
          <img 
            src="/logo.png" 
            alt="FUIK Logo" 
            className="h-8 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/favicon.png';
            }}
          />
          {!collapsed && (
            <span className="font-semibold text-sidebar-foreground">FUIK</span>
          )}
        </a>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Executive Dashboard - Only for managers/owners */}
        {(isAdmin() || canView("analytics")) && (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/") || isActive("/executive")}
                  tooltip="Executive Dashboard"
                >
                  <a
                    href="/"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/");
                    }}
                    className="flex items-center gap-2"
                  >
                    <BarChart3 className="h-4 w-4" />
                    {!collapsed && <span className="font-medium">Executive Dashboard</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        <Separator className="my-2" />

        {/* Department Sections */}
        <SidebarGroup>
          <SidebarGroupLabel className={cn(collapsed && "sr-only")}>
            Departments
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuSections.map(renderSection)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2" />

        {/* Reports Section */}
        {(isAdmin() || canView("analytics")) && (
          <SidebarGroup>
            <SidebarGroupLabel className={cn(collapsed && "sr-only")}>
              Reports
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/reports/library")}
                    tooltip="Report Library"
                  >
                    <a
                      href="/reports/library"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/reports/library");
                      }}
                      className="flex items-center gap-2"
                    >
                      <FileBarChart className="h-4 w-4" />
                      {!collapsed && <span>Report Library</span>}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/reports/scheduled")}
                    tooltip="Scheduled Reports"
                  >
                    <a
                      href="/reports/scheduled"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/reports/scheduled");
                      }}
                      className="flex items-center gap-2"
                    >
                      <CalendarClock className="h-4 w-4" />
                      {!collapsed && <span>Scheduled Reports</span>}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <Separator className="my-2" />

        {/* Settings Section */}
        {isAdmin() && (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/settings")}
                  tooltip="Settings"
                >
                  <a
                    href="/settings"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/settings");
                    }}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    {!collapsed && <span>Settings</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/users")}
                  tooltip="User Management"
                >
                  <a
                    href="/users"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/users");
                    }}
                    className="flex items-center gap-2"
                  >
                    <UserCog className="h-4 w-4" />
                    {!collapsed && <span>User Management</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {collapsed ? (
          <CollapsedFooter 
            getInitials={getInitials} 
            userEmail={user?.email} 
            onSignOut={handleSignOut} 
            signingOut={signingOut} 
          />
        ) : (
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-sidebar-foreground truncate max-w-[120px]">
                  {user?.email}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                disabled={signingOut}
                className="h-8 w-8"
              >
                {signingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
