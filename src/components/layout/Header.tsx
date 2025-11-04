import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, History, PlusCircle, LayoutDashboard, Calculator } from 'lucide-react';

export const Header = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

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
        </nav>
      </div>
    </header>
  );
};
