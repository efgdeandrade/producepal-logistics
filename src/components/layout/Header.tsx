import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, History, PlusCircle, LayoutDashboard, Users, Activity, LogOut, MapPin, Truck, Factory, TrendingUp, Settings, ChevronDown, Calculator, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { usePermissions } from '@/hooks/usePermissions';
import { useState, useEffect } from 'react';
import { format, getWeek } from 'date-fns';

export const Header = () => {
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const { canView, loading: permissionsLoading } = usePermissions();
  const [currentTime, setCurrentTime] = useState(new Date());

  const isActive = (path: string) => location.pathname === path;

  const getInitials = (email?: string) => {
    if (!email) return 'U';
    return email.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (permissionsLoading) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="Fuik.io Logo" className="h-8 object-contain" />
          </Link>
          <div className="hidden md:flex flex-col text-sm">
            <div className="font-semibold text-foreground">
              {format(currentTime, 'EEE, MMM d, yyyy')}
            </div>
            <div className="text-muted-foreground">
              {format(currentTime, 'HH:mm:ss')} • Week {getWeek(currentTime)}
            </div>
          </div>
        </div>
        
        <nav className="flex items-center space-x-2">
          {canView('dashboard') && (
            <Button
              variant={isActive('/') ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          )}

          {canView('orders') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  Orders
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/order/new">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Order
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/history">
                    <History className="mr-2 h-4 w-4" />
                    History
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/cif-calculator">
                    <Calculator className="mr-2 h-4 w-4" />
                    CIF Calculator
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {canView('data') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  Data
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/suppliers">
                    <Package className="mr-2 h-4 w-4" />
                    Suppliers
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/products">
                    <Package className="mr-2 h-4 w-4" />
                    Products
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/customers">
                    <Users className="mr-2 h-4 w-4" />
                    Customers
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {canView('logistics') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  Logistics
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link to="/routes">
                    <MapPin className="mr-2 h-4 w-4" />
                    Routes
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/deliveries">
                    <Truck className="mr-2 h-4 w-4" />
                    Deliveries
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/invoices">
                    <FileText className="mr-2 h-4 w-4" />
                    Invoices
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {canView('production') && (
            <Button
              variant={isActive('/production') ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/production">
                <Factory className="mr-2 h-4 w-4" />
                Production
              </Link>
            </Button>
          )}

          {canView('analytics') && (
            <Button
              variant={isActive('/analytics') ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/analytics">
                <TrendingUp className="mr-2 h-4 w-4" />
                Analytics
              </Link>
            </Button>
          )}

          {isAdmin() && (
            <>
              <Button
                variant={isActive('/user-management') ? 'default' : 'ghost'}
                size="sm"
                asChild
              >
                <Link to="/user-management">
                  <Users className="mr-2 h-4 w-4" />
                  Users
                </Link>
              </Button>
              <Button
                variant={isActive('/user-activity') ? 'default' : 'ghost'}
                size="sm"
                asChild
              >
                <Link to="/user-activity">
                  <Activity className="mr-2 h-4 w-4" />
                  Activity
                </Link>
              </Button>
              <Button
                variant={isActive('/settings') ? 'default' : 'ghost'}
                size="sm"
                asChild
              >
                <Link to="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </>
          )}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
