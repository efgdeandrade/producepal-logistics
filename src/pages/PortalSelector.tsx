import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  Store, 
  Package, 
  Factory, 
  Users, 
  Truck,
  LogOut,
  Shield,
  BarChart3,
  Settings,
  Loader2,
  DollarSign,
  Megaphone
} from 'lucide-react';
import { useState } from 'react';

interface PortalOption {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  color: string;
  permission?: string;
}

const portals: PortalOption[] = [
  {
    id: 'distribution',
    title: 'Distribution',
    description: 'Orders, picking, invoicing, customers, WhatsApp & Email inbox',
    icon: Store,
    path: '/distribution',
    color: 'bg-emerald-500',
  },
  {
    id: 'import',
    title: 'Import',
    description: 'CIF calculations, shipment tracking, supplier management',
    icon: Package,
    path: '/import',
    color: 'bg-blue-500',
  },
  {
    id: 'production',
    title: 'Production',
    description: 'Production planning, bakery input, manufacturing',
    icon: Factory,
    path: '/production',
    color: 'bg-amber-500',
  },
  {
    id: 'hr',
    title: 'HR & Logistics',
    description: 'Time & attendance, employees, documents, fleet management',
    icon: Users,
    path: '/hr',
    color: 'bg-purple-500',
  },
  {
    id: 'finance',
    title: 'Finance',
    description: 'Revenue, invoices, outstanding balances, Ace AI insights',
    icon: DollarSign,
    path: '/finance',
    color: 'bg-primary',
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description: 'Customer segments, top products, broadcast, Maya AI insights',
    icon: Megaphone,
    path: '/marketing',
    color: 'bg-purple-600',
  },
];

const adminOptions: PortalOption[] = [
  {
    id: 'admin',
    title: 'Admin Dashboard',
    description: 'Executive overview, reports, analytics',
    icon: BarChart3,
    path: '/admin',
    color: 'bg-slate-700',
    permission: 'admin',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Users, integrations, system configuration',
    icon: Settings,
    path: '/admin/settings',
    color: 'bg-slate-600',
    permission: 'admin',
  },
];

export default function PortalSelector() {
  const navigate = useNavigate();
  const { user, signOut, isAdmin, hasRole } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  const handlePortalSelect = (path: string) => {
    navigate(path);
  };

  const isDriver = hasRole('driver');

  // If user is a driver, redirect to driver portal
  if (isDriver && !isAdmin()) {
    navigate('/driver');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="FUIK Logo" 
              className="h-10 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/favicon.png';
              }}
            />
            <div>
              <h1 className="font-bold text-lg">FUIK</h1>
              <p className="text-xs text-muted-foreground">Business Management</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50">
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              {isAdmin() && (
                <Badge variant="secondary" className="gap-1">
                  <Shield className="h-3 w-3" />
                  Admin
                </Badge>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Section */}
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Welcome back!
            </h2>
            <p className="text-muted-foreground text-lg">
              Select a portal to get started
            </p>
          </div>

          {/* Portal Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
            {portals.map((portal) => (
              <Card 
                key={portal.id}
                className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50 overflow-hidden"
                onClick={() => handlePortalSelect(portal.path)}
              >
                <div className={`h-1.5 ${portal.color}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${portal.color} text-white`}>
                      <portal.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                      {portal.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {portal.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Admin Section */}
          {isAdmin() && (
            <div className="border-t pt-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                Administration
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {adminOptions.map((option) => (
                  <Card 
                    key={option.id}
                    className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50"
                    onClick={() => handlePortalSelect(option.path)}
                  >
                    <CardHeader className="py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${option.color} text-white`}>
                          <option.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base group-hover:text-primary transition-colors">
                            {option.title}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {option.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Driver Quick Access */}
          {isAdmin() && (
            <div className="border-t pt-8 mt-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5 text-muted-foreground" />
                Driver Access
              </h3>
              <Card 
                className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 max-w-sm"
                onClick={() => handlePortalSelect('/driver')}
              >
                <CardHeader className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500 text-white">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base group-hover:text-primary transition-colors">
                        Driver Portal
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Test the mobile driver experience
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} FUIK. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
