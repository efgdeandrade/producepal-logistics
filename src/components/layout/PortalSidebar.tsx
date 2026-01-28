import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { useEmailInboxCount } from '@/hooks/useEmailInboxCount';

export interface PortalNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  showBadge?: boolean;
}

interface PortalSidebarProps {
  portalName: string;
  portalPath: string;
  portalIcon: ReactNode;
  navItems: PortalNavItem[];
}

export function PortalSidebar({ portalName, portalPath, portalIcon, navItems }: PortalSidebarProps) {
  const location = useLocation();
  const { unreadCount } = useEmailInboxCount();
  
  const isActive = (path: string) => {
    if (path === portalPath) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b px-4 py-3">
        <Link to={portalPath} className="flex items-center gap-2">
          {portalIcon}
          <span className="font-semibold text-lg">{portalName}</span>
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="px-2 py-4">
        <SidebarMenu>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const showBadge = item.showBadge && unreadCount > 0;
            
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton asChild>
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                      active 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {showBadge && (
                      <span className={cn(
                        "min-w-[20px] h-[20px] flex items-center justify-center rounded-full text-[11px] font-bold px-1",
                        active 
                          ? "bg-primary-foreground text-primary" 
                          : "bg-destructive text-destructive-foreground"
                      )}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter className="border-t px-2 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link
                to="/select-portal"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Portal Selector</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
