import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, History, PlusCircle, LayoutDashboard, Calculator, Users, Activity, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export const Header = () => {
  const location = useLocation();
  const { user, isAdmin, hasRole, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const getInitials = (email?: string) => {
    if (!email) return 'U';
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <Package className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-foreground">Fuik.io</span>
        </Link>
        
        <nav className="flex items-center space-x-2">
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
          <Button
            variant={isActive('/new-order') ? 'default' : 'ghost'}
            size="sm"
            asChild
          >
            <Link to="/new-order">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Order
            </Link>
          </Button>
          <Button
            variant={isActive('/history') ? 'default' : 'ghost'}
            size="sm"
            asChild
          >
            <Link to="/history">
              <History className="mr-2 h-4 w-4" />
              History
            </Link>
          </Button>
          <Button
            variant={isActive('/suppliers') ? 'default' : 'ghost'}
            size="sm"
            asChild
          >
            <Link to="/suppliers">
              <Package className="mr-2 h-4 w-4" />
              Suppliers
            </Link>
          </Button>
          <Button
            variant={isActive('/products') ? 'default' : 'ghost'}
            size="sm"
            asChild
          >
            <Link to="/products">
              <Package className="mr-2 h-4 w-4" />
              Products
            </Link>
          </Button>
          <Button
            variant={isActive('/cif-calculator') ? 'default' : 'ghost'}
            size="sm"
            asChild
          >
            <Link to="/cif-calculator">
              <Calculator className="mr-2 h-4 w-4" />
              CIF Calculator
            </Link>
          </Button>

          {isAdmin() && (
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
          )}

          {(isAdmin() || hasRole('management')) && (
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
