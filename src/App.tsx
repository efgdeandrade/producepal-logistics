import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PasswordChangeRequired } from "@/components/PasswordChangeRequired";
import { VersionUpdateToast } from "@/components/VersionUpdateToast";
import { AppLayout } from "@/components/layout/AppLayout";

// Executive
import ExecutiveDashboard from "./pages/ExecutiveDashboard";

// Import Department (formerly Dashboard, Orders, etc.)
import Dashboard from "./pages/Dashboard";
import ImportDashboard from "./pages/ImportDashboard";
import NewOrder from "./pages/NewOrder";
import History from "./pages/History";
import OrderDetails from "./pages/OrderDetails";
import Suppliers from "./pages/Suppliers";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import CIFCalculator from "./pages/CIFCalculator";
import CIFCalculatorHistory from "./pages/CIFCalculatorHistory";
import ConsolidationGroups from "./pages/ConsolidationGroups";
import StandingOrders from "./pages/StandingOrders";

// Distribution Department (formerly F&B)
import DistributionDashboard from "./pages/DistributionDashboard";
import FnbDashboard from "./pages/fnb/FnbDashboard";
import FnbProducts from "./pages/fnb/FnbProducts";
import FnbCustomers from "./pages/fnb/FnbCustomers";
import FnbOrders from "./pages/fnb/FnbOrders";
import FnbNewOrder from "./pages/fnb/FnbNewOrder";
import FnbPicker from "./pages/fnb/FnbPicker";
import FnbPickerSupervisor from "./pages/fnb/FnbPickerSupervisor";
import FnbDeliveryManagement from "./pages/fnb/FnbDeliveryManagement";
import FnbCODReconciliation from "./pages/fnb/FnbCODReconciliation";
import FnbAnalytics from "./pages/fnb/FnbAnalytics";
import FnbZoneManagement from "./pages/fnb/FnbZoneManagement";
import FnbWeeklyBoard from "./pages/fnb/FnbWeeklyBoard";
import FnbReceiptVerification from "./pages/fnb/FnbReceiptVerification";
import FnbStandingOrders from "./pages/fnb/FnbStandingOrders";
import FnbPricingTiers from "./pages/fnb/FnbPricingTiers";
import FnbSettings from "./pages/fnb/FnbSettings";

// Logistics Department
import LogisticsDashboard from "./pages/LogisticsDashboard";
import RoutesPage from "./pages/Routes";
import DriverPortal from "./pages/DriverPortal";
import DeliveryManagement from "./pages/DeliveryManagement";
import Invoices from "./pages/Invoices";
import FnbDriverPortal from "./pages/fnb/FnbDriverPortal";
import FnbDriverMobile from "./pages/fnb/FnbDriverMobile";
import FnbDriverSchedule from "./pages/fnb/FnbDriverSchedule";
import FnbDispatch from "./pages/fnb/FnbDispatch";
import FnbDriverZones from "./pages/fnb/FnbDriverZones";

// Production Department
import ProductionDashboard from "./pages/ProductionDashboard";
import ProductionDashboardNew from "./pages/ProductionDashboardNew";
import ProductionInput from "./pages/ProductionInput";
import ProductionEdit from "./pages/ProductionEdit";

// HR Department
import HRDashboard from "./pages/hr/HRDashboard";
import Employees from "./pages/hr/Employees";
import TimeAttendance from "./pages/hr/TimeAttendance";
import Timesheets from "./pages/hr/Timesheets";
import Documents from "./pages/hr/Documents";

// Settings & Admin
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";
import UserActivity from "./pages/UserActivity";
import PredictionsAnalytics from "./pages/PredictionsAnalytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";

const queryClient = new QueryClient();

// Wrapper for protected routes with layout
const ProtectedWithLayout = ({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) => (
  <ProtectedRoute requiredRole={requiredRole}>
    <PasswordChangeRequired>
      <AppLayout>{children}</AppLayout>
    </PasswordChangeRequired>
  </ProtectedRoute>
);

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <VersionUpdateToast />
          <BrowserRouter>
            <Routes>
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

              {/* ========== DISTRIBUTION DEPARTMENT (formerly F&B) ========== */}
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
              <Route path="/users" element={<ProtectedWithLayout requiredRole="admin"><UserManagement /></ProtectedWithLayout>} />
              <Route path="/user-activity" element={<ProtectedWithLayout><UserActivity /></ProtectedWithLayout>} />
              <Route path="/analytics" element={<ProtectedWithLayout><PredictionsAnalytics /></ProtectedWithLayout>} />

              {/* ========== LEGACY ROUTES (redirects for backwards compatibility) ========== */}
              {/* These can be removed after transition period */}
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
              <Route path="/fnb/standing-orders" element={<ProtectedWithLayout><FnbStandingOrders /></ProtectedWithLayout>} />
              <Route path="/fnb/receipts" element={<ProtectedWithLayout><FnbReceiptVerification /></ProtectedWithLayout>} />
              <Route path="/fnb/settings" element={<ProtectedWithLayout><FnbSettings /></ProtectedWithLayout>} />
              <Route path="/fnb/driver-mobile" element={<ProtectedWithLayout requiredRole="driver"><FnbDriverMobile /></ProtectedWithLayout>} />
              <Route path="/fnb/pricing-tiers" element={<ProtectedWithLayout><FnbPricingTiers /></ProtectedWithLayout>} />
              <Route path="/fnb/driver-schedule" element={<ProtectedWithLayout><FnbDriverSchedule /></ProtectedWithLayout>} />
              <Route path="/fnb/dispatch" element={<ProtectedWithLayout><FnbDispatch /></ProtectedWithLayout>} />
              <Route path="/fnb/driver-zones" element={<ProtectedWithLayout><FnbDriverZones /></ProtectedWithLayout>} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
