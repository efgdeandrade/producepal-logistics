import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { lazy, Suspense, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./components/ThemeProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PasswordChangeRequired } from "./components/PasswordChangeRequired";
import { VersionUpdateToast } from "./components/VersionUpdateToast";
import { AppLayout } from "./components/layout/AppLayout";
import { BottomNavigation } from "./components/mobile/BottomNavigation";
import { InstallBanner } from "./components/pwa/InstallBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Loading fallback component
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background, #0a0a0a)', color: 'var(--foreground, #fff)' }}>
    <div>Loading...</div>
  </div>
);

// ===== LAZY LOADED PAGES =====
// Executive
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));

// Import Department
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ImportDashboard = lazy(() => import("./pages/ImportDashboard"));
const NewOrder = lazy(() => import("./pages/NewOrder"));
const History = lazy(() => import("./pages/History"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Products = lazy(() => import("./pages/Products"));
const Customers = lazy(() => import("./pages/Customers"));
const CIFCalculator = lazy(() => import("./pages/CIFCalculator"));
const CIFCalculatorHistory = lazy(() => import("./pages/CIFCalculatorHistory"));
const ConsolidationGroups = lazy(() => import("./pages/ConsolidationGroups"));
const StandingOrders = lazy(() => import("./pages/StandingOrders"));

// Distribution Department
const DistributionDashboard = lazy(() => import("./pages/DistributionDashboard"));
const FnbDashboard = lazy(() => import("./pages/fnb/FnbDashboard"));
const FnbProducts = lazy(() => import("./pages/fnb/FnbProducts"));
const FnbCustomers = lazy(() => import("./pages/fnb/FnbCustomers"));
const FnbOrders = lazy(() => import("./pages/fnb/FnbOrders"));
const FnbNewOrder = lazy(() => import("./pages/fnb/FnbNewOrder"));
const FnbPicker = lazy(() => import("./pages/fnb/FnbPicker"));
const FnbPickerSupervisor = lazy(() => import("./pages/fnb/FnbPickerSupervisor"));
const FnbDeliveryManagement = lazy(() => import("./pages/fnb/FnbDeliveryManagement"));
const FnbCODReconciliation = lazy(() => import("./pages/fnb/FnbCODReconciliation"));
const FnbAnalytics = lazy(() => import("./pages/fnb/FnbAnalytics"));
const FnbZoneManagement = lazy(() => import("./pages/fnb/FnbZoneManagement"));
const FnbWeeklyBoard = lazy(() => import("./pages/fnb/FnbWeeklyBoard"));
const FnbReceiptVerification = lazy(() => import("./pages/fnb/FnbReceiptVerification"));
const FnbStandingOrders = lazy(() => import("./pages/fnb/FnbStandingOrders"));
const FnbPricingTiers = lazy(() => import("./pages/fnb/FnbPricingTiers"));
const FnbSettings = lazy(() => import("./pages/fnb/FnbSettings"));
const FnbQuickPaste = lazy(() => import("./pages/fnb/FnbQuickPaste"));

// Logistics Department
const LogisticsDashboard = lazy(() => import("./pages/LogisticsDashboard"));
const RoutesPage = lazy(() => import("./pages/Routes"));
const DriverPortal = lazy(() => import("./pages/DriverPortal"));
const DeliveryManagement = lazy(() => import("./pages/DeliveryManagement"));
const Invoices = lazy(() => import("./pages/Invoices"));
const FnbDriverPortal = lazy(() => import("./pages/fnb/FnbDriverPortal"));
const FnbDriverMobile = lazy(() => import("./pages/fnb/FnbDriverMobile"));
const FnbDriverSchedule = lazy(() => import("./pages/fnb/FnbDriverSchedule"));
const FnbDispatch = lazy(() => import("./pages/fnb/FnbDispatch"));
const FnbDriverZones = lazy(() => import("./pages/fnb/FnbDriverZones"));

// Production Department
const ProductionDashboard = lazy(() => import("./pages/ProductionDashboard"));
const ProductionDashboardNew = lazy(() => import("./pages/ProductionDashboardNew"));
const ProductionInput = lazy(() => import("./pages/ProductionInput"));
const ProductionEdit = lazy(() => import("./pages/ProductionEdit"));

// HR Department
const HRDashboard = lazy(() => import("./pages/hr/HRDashboard"));
const Employees = lazy(() => import("./pages/hr/Employees"));
const TimeAttendance = lazy(() => import("./pages/hr/TimeAttendance"));
const Timesheets = lazy(() => import("./pages/hr/Timesheets"));
const Documents = lazy(() => import("./pages/hr/Documents"));

// Settings & Admin
const Auth = lazy(() => import("./pages/Auth"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const UserActivity = lazy(() => import("./pages/UserActivity"));
const PredictionsAnalytics = lazy(() => import("./pages/PredictionsAnalytics"));
const ExecutiveReports = lazy(() => import("./pages/ExecutiveReports"));
const Settings = lazy(() => import("./pages/Settings"));
const ReportLibrary = lazy(() => import("./pages/ReportLibrary"));
const ScheduledReports = lazy(() => import("./pages/ScheduledReports"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Install = lazy(() => import("./pages/Install"));
const Offline = lazy(() => import("./pages/Offline"));

// Integrations
const IntegrationHub = lazy(() => import("./pages/integrations/IntegrationHub"));
const WhatsAppSettings = lazy(() => import("./pages/integrations/WhatsAppSettings"));
const QuickBooksSync = lazy(() => import("./pages/integrations/QuickBooksSync"));
const WebhookManager = lazy(() => import("./pages/integrations/WebhookManager"));
const ApiConnectors = lazy(() => import("./pages/integrations/ApiConnectors"));

const queryClient = new QueryClient();

// Wrapper for protected routes with layout
const ProtectedWithLayout = ({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) => (
  <ProtectedRoute requiredRole={requiredRole}>
    <PasswordChangeRequired>
      <AppLayout>{children}</AppLayout>
    </PasswordChangeRequired>
  </ProtectedRoute>
);

// Offline detection wrapper
const OfflineWrapper = ({ children }: { children: React.ReactNode }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Offline />
      </Suspense>
    );
  }

  return <>{children}</>;
};

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <ErrorBoundary>
            <OfflineWrapper>
              <Toaster />
              <Sonner />
              <VersionUpdateToast />
              <BrowserRouter>
                <InstallBanner />
                <BottomNavigation />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Health check - always works */}
                    <Route path="/health" element={<div style={{ padding: 20 }}>OK - App is running</div>} />

                    {/* Auth - No layout */}
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/install" element={<Install />} />

                    {/* Executive Dashboard */}
                    <Route path="/" element={<ProtectedWithLayout><ExecutiveDashboard /></ProtectedWithLayout>} />

                    {/* ========== IMPORT DEPARTMENT ========== */}
                    <Route path="/import" element={<ProtectedWithLayout><ImportDashboard /></ProtectedWithLayout>} />
                    <Route path="/import/orders" element={<ProtectedWithLayout><History /></ProtectedWithLayout>} />
                    <Route path="/import/orders/new" element={<ProtectedWithLayout><NewOrder /></ProtectedWithLayout>} />
                    <Route path="/import/orders/edit/:orderId" element={<ProtectedWithLayout><NewOrder /></ProtectedWithLayout>} />
                    <Route path="/import/orders/:orderId" element={<ProtectedWithLayout><OrderDetails /></ProtectedWithLayout>} />
                    <Route path="/import/standing-orders" element={<ProtectedWithLayout><StandingOrders /></ProtectedWithLayout>} />
                    <Route path="/import/cif" element={<ProtectedWithLayout><CIFCalculator /></ProtectedWithLayout>} />
                    <Route path="/import/cif/history" element={<ProtectedWithLayout><CIFCalculatorHistory /></ProtectedWithLayout>} />
                    <Route path="/import/suppliers" element={<ProtectedWithLayout><Suppliers /></ProtectedWithLayout>} />
                    <Route path="/import/products" element={<ProtectedWithLayout><Products /></ProtectedWithLayout>} />
                    <Route path="/import/customers" element={<ProtectedWithLayout><Customers /></ProtectedWithLayout>} />
                    <Route path="/import/consolidation" element={<ProtectedWithLayout><ConsolidationGroups /></ProtectedWithLayout>} />

                    {/* ========== DISTRIBUTION DEPARTMENT ========== */}
                    <Route path="/distribution" element={<ProtectedWithLayout><DistributionDashboard /></ProtectedWithLayout>} />
                    <Route path="/distribution/orders" element={<ProtectedWithLayout><FnbOrders /></ProtectedWithLayout>} />
                    <Route path="/distribution/orders/new" element={<ProtectedWithLayout><FnbNewOrder /></ProtectedWithLayout>} />
                    <Route path="/distribution/orders/edit/:orderId" element={<ProtectedWithLayout><FnbNewOrder /></ProtectedWithLayout>} />
                    <Route path="/distribution/weekly" element={<ProtectedWithLayout><FnbWeeklyBoard /></ProtectedWithLayout>} />
                    <Route path="/distribution/standing-orders" element={<ProtectedWithLayout><FnbStandingOrders /></ProtectedWithLayout>} />
                    <Route path="/distribution/picker" element={<ProtectedWithLayout><FnbPicker /></ProtectedWithLayout>} />
                    <Route path="/distribution/picker/:orderId" element={<ProtectedWithLayout><FnbPicker /></ProtectedWithLayout>} />
                    <Route path="/distribution/picker/supervisor" element={<ProtectedWithLayout><FnbPickerSupervisor /></ProtectedWithLayout>} />
                    <Route path="/distribution/receipts" element={<ProtectedWithLayout><FnbReceiptVerification /></ProtectedWithLayout>} />
                    <Route path="/distribution/customers" element={<ProtectedWithLayout><FnbCustomers /></ProtectedWithLayout>} />
                    <Route path="/distribution/products" element={<ProtectedWithLayout><FnbProducts /></ProtectedWithLayout>} />
                    <Route path="/distribution/pricing" element={<ProtectedWithLayout><FnbPricingTiers /></ProtectedWithLayout>} />
                    <Route path="/distribution/zones" element={<ProtectedWithLayout><FnbZoneManagement /></ProtectedWithLayout>} />
                    <Route path="/distribution/cod" element={<ProtectedWithLayout><FnbCODReconciliation /></ProtectedWithLayout>} />
                    <Route path="/distribution/analytics" element={<ProtectedWithLayout><FnbAnalytics /></ProtectedWithLayout>} />
                    <Route path="/distribution/settings" element={<ProtectedWithLayout><FnbSettings /></ProtectedWithLayout>} />
                    
                    {/* Quick Paste */}
                    <Route path="/quick-paste" element={<ProtectedWithLayout><FnbQuickPaste /></ProtectedWithLayout>} />

                    {/* ========== LOGISTICS DEPARTMENT ========== */}
                    <Route path="/logistics" element={<ProtectedWithLayout><LogisticsDashboard /></ProtectedWithLayout>} />
                    <Route path="/logistics/dispatch" element={<ProtectedWithLayout><FnbDispatch /></ProtectedWithLayout>} />
                    <Route path="/logistics/routes" element={<ProtectedWithLayout><RoutesPage /></ProtectedWithLayout>} />
                    <Route path="/logistics/schedule" element={<ProtectedWithLayout><FnbDriverSchedule /></ProtectedWithLayout>} />
                    <Route path="/logistics/driver-zones" element={<ProtectedWithLayout><FnbDriverZones /></ProtectedWithLayout>} />
                    <Route path="/logistics/deliveries" element={<ProtectedWithLayout><DeliveryManagement /></ProtectedWithLayout>} />
                    <Route path="/logistics/invoices" element={<ProtectedWithLayout><Invoices /></ProtectedWithLayout>} />
                    <Route path="/logistics/driver-portal" element={<ProtectedWithLayout requiredRole="driver"><FnbDriverPortal /></ProtectedWithLayout>} />
                    <Route path="/logistics/driver-mobile" element={<ProtectedWithLayout requiredRole="driver"><FnbDriverMobile /></ProtectedWithLayout>} />

                    {/* ========== PRODUCTION DEPARTMENT ========== */}
                    <Route path="/production" element={<ProtectedWithLayout><ProductionDashboardNew /></ProtectedWithLayout>} />
                    <Route path="/production/dashboard" element={<ProtectedWithLayout><ProductionDashboard /></ProtectedWithLayout>} />
                    <Route path="/production/input" element={<ProtectedWithLayout><ProductionInput /></ProtectedWithLayout>} />
                    <Route path="/production/edit/:orderId" element={<ProtectedWithLayout><ProductionEdit /></ProtectedWithLayout>} />

                    {/* ========== HR DEPARTMENT ========== */}
                    <Route path="/hr" element={<ProtectedWithLayout><HRDashboard /></ProtectedWithLayout>} />
                    <Route path="/hr/employees" element={<ProtectedWithLayout><Employees /></ProtectedWithLayout>} />
                    <Route path="/hr/attendance" element={<ProtectedWithLayout><TimeAttendance /></ProtectedWithLayout>} />
                    <Route path="/hr/timesheets" element={<ProtectedWithLayout><Timesheets /></ProtectedWithLayout>} />
                    <Route path="/hr/documents" element={<ProtectedWithLayout><Documents /></ProtectedWithLayout>} />

                    {/* ========== SETTINGS & ADMIN ========== */}
                    <Route path="/settings" element={<ProtectedWithLayout requiredRole="admin"><Settings /></ProtectedWithLayout>} />
                    <Route path="/settings/integrations" element={<ProtectedWithLayout requiredRole="admin"><IntegrationHub /></ProtectedWithLayout>} />
                    <Route path="/settings/integrations/whatsapp" element={<ProtectedWithLayout requiredRole="admin"><WhatsAppSettings /></ProtectedWithLayout>} />
                    <Route path="/settings/integrations/quickbooks" element={<ProtectedWithLayout requiredRole="admin"><QuickBooksSync /></ProtectedWithLayout>} />
                    <Route path="/settings/integrations/webhooks" element={<ProtectedWithLayout requiredRole="admin"><WebhookManager /></ProtectedWithLayout>} />
                    <Route path="/settings/integrations/api" element={<ProtectedWithLayout requiredRole="admin"><ApiConnectors /></ProtectedWithLayout>} />
                    <Route path="/users" element={<ProtectedWithLayout requiredRole="admin"><UserManagement /></ProtectedWithLayout>} />
                    <Route path="/user-activity" element={<ProtectedWithLayout><UserActivity /></ProtectedWithLayout>} />
                    <Route path="/analytics" element={<ProtectedWithLayout><PredictionsAnalytics /></ProtectedWithLayout>} />
                    <Route path="/reports" element={<ProtectedWithLayout><ExecutiveReports /></ProtectedWithLayout>} />
                    <Route path="/reports/library" element={<ProtectedWithLayout><ReportLibrary /></ProtectedWithLayout>} />
                    <Route path="/reports/scheduled" element={<ProtectedWithLayout><ScheduledReports /></ProtectedWithLayout>} />

                    {/* ========== LEGACY ROUTES ========== */}
                    <Route path="/order/new" element={<ProtectedWithLayout><NewOrder /></ProtectedWithLayout>} />
                    <Route path="/order/edit/:orderId" element={<ProtectedWithLayout><NewOrder /></ProtectedWithLayout>} />
                    <Route path="/order/:orderId" element={<ProtectedWithLayout><OrderDetails /></ProtectedWithLayout>} />
                    <Route path="/history" element={<ProtectedWithLayout><History /></ProtectedWithLayout>} />
                    <Route path="/suppliers" element={<ProtectedWithLayout><Suppliers /></ProtectedWithLayout>} />
                    <Route path="/products" element={<ProtectedWithLayout><Products /></ProtectedWithLayout>} />
                    <Route path="/customers" element={<ProtectedWithLayout><Customers /></ProtectedWithLayout>} />
                    <Route path="/consolidation-groups" element={<ProtectedWithLayout><ConsolidationGroups /></ProtectedWithLayout>} />
                    <Route path="/cif-calculator" element={<ProtectedWithLayout><CIFCalculator /></ProtectedWithLayout>} />
                    <Route path="/cif-calculator-history" element={<ProtectedWithLayout><CIFCalculatorHistory /></ProtectedWithLayout>} />
                    <Route path="/standing-orders" element={<ProtectedWithLayout><StandingOrders /></ProtectedWithLayout>} />
                    <Route path="/routes" element={<ProtectedWithLayout><RoutesPage /></ProtectedWithLayout>} />
                    <Route path="/driver-portal" element={<ProtectedWithLayout requiredRole="driver"><DriverPortal /></ProtectedWithLayout>} />
                    <Route path="/deliveries" element={<ProtectedWithLayout><DeliveryManagement /></ProtectedWithLayout>} />
                    <Route path="/invoices" element={<ProtectedWithLayout><Invoices /></ProtectedWithLayout>} />
                    <Route path="/production-input" element={<ProtectedWithLayout><ProductionInput /></ProtectedWithLayout>} />
                    <Route path="/production-edit/:orderId" element={<ProtectedWithLayout><ProductionEdit /></ProtectedWithLayout>} />
                    <Route path="/user-management" element={<ProtectedWithLayout requiredRole="admin"><UserManagement /></ProtectedWithLayout>} />

                    {/* F&B Legacy Routes */}
                    <Route path="/fnb" element={<ProtectedWithLayout><FnbDashboard /></ProtectedWithLayout>} />
                    <Route path="/fnb/products" element={<ProtectedWithLayout><FnbProducts /></ProtectedWithLayout>} />
                    <Route path="/fnb/customers" element={<ProtectedWithLayout><FnbCustomers /></ProtectedWithLayout>} />
                    <Route path="/fnb/orders" element={<ProtectedWithLayout><FnbOrders /></ProtectedWithLayout>} />
                    <Route path="/fnb/orders/new" element={<ProtectedWithLayout><FnbNewOrder /></ProtectedWithLayout>} />
                    <Route path="/fnb/orders/edit/:orderId" element={<ProtectedWithLayout><FnbNewOrder /></ProtectedWithLayout>} />
                    <Route path="/fnb/picker/:orderId?" element={<ProtectedWithLayout><FnbPicker /></ProtectedWithLayout>} />
                    <Route path="/fnb/picker/supervisor" element={<ProtectedWithLayout><FnbPickerSupervisor /></ProtectedWithLayout>} />
                    <Route path="/fnb/delivery" element={<ProtectedWithLayout><FnbDeliveryManagement /></ProtectedWithLayout>} />
                    <Route path="/fnb/driver-portal" element={<ProtectedWithLayout requiredRole="driver"><FnbDriverPortal /></ProtectedWithLayout>} />
                    <Route path="/fnb/cod" element={<ProtectedWithLayout><FnbCODReconciliation /></ProtectedWithLayout>} />
                    <Route path="/fnb/analytics" element={<ProtectedWithLayout><FnbAnalytics /></ProtectedWithLayout>} />
                    <Route path="/fnb/zones" element={<ProtectedWithLayout><FnbZoneManagement /></ProtectedWithLayout>} />
                    <Route path="/fnb/weekly" element={<ProtectedWithLayout><FnbWeeklyBoard /></ProtectedWithLayout>} />
                    <Route path="/fnb/receipts" element={<ProtectedWithLayout><FnbReceiptVerification /></ProtectedWithLayout>} />
                    <Route path="/fnb/standing-orders" element={<ProtectedWithLayout><FnbStandingOrders /></ProtectedWithLayout>} />
                    <Route path="/fnb/pricing" element={<ProtectedWithLayout><FnbPricingTiers /></ProtectedWithLayout>} />
                    <Route path="/fnb/settings" element={<ProtectedWithLayout><FnbSettings /></ProtectedWithLayout>} />

                    {/* 404 */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </OfflineWrapper>
          </ErrorBoundary>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
