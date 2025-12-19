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
import Dashboard from "./pages/Dashboard";
import NewOrder from "./pages/NewOrder";
import History from "./pages/History";
import OrderDetails from "./pages/OrderDetails";
import Suppliers from "./pages/Suppliers";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import RoutesPage from "./pages/Routes";
import DriverPortal from "./pages/DriverPortal";
import CIFCalculator from "./pages/CIFCalculator";
import CIFCalculatorHistory from "./pages/CIFCalculatorHistory";
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";
import UserActivity from "./pages/UserActivity";
import ProductionDashboard from "./pages/ProductionDashboard";
import ProductionInput from "./pages/ProductionInput";
import ProductionEdit from "./pages/ProductionEdit";
import DeliveryManagement from "./pages/DeliveryManagement";
import Invoices from "./pages/Invoices";
import PredictionsAnalytics from "./pages/PredictionsAnalytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import ConsolidationGroups from "./pages/ConsolidationGroups";
import StandingOrders from "./pages/StandingOrders";
// F&B Pages
import FnbDashboard from "./pages/fnb/FnbDashboard";
import FnbProducts from "./pages/fnb/FnbProducts";
import FnbCustomers from "./pages/fnb/FnbCustomers";
import FnbOrders from "./pages/fnb/FnbOrders";
import FnbNewOrder from "./pages/fnb/FnbNewOrder";
import FnbPicker from "./pages/fnb/FnbPicker";
import FnbPickerSupervisor from "./pages/fnb/FnbPickerSupervisor";
import FnbSettings from "./pages/fnb/FnbSettings";
import FnbDeliveryManagement from "./pages/fnb/FnbDeliveryManagement";
import FnbDriverPortal from "./pages/fnb/FnbDriverPortal";
import FnbCODReconciliation from "./pages/fnb/FnbCODReconciliation";
import FnbAnalytics from "./pages/fnb/FnbAnalytics";
import FnbZoneManagement from "./pages/fnb/FnbZoneManagement";
import FnbWeeklyBoard from "./pages/fnb/FnbWeeklyBoard";
import FnbReceiptVerification from "./pages/fnb/FnbReceiptVerification";

const queryClient = new QueryClient();

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
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><PasswordChangeRequired><Dashboard /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/order/new" element={<ProtectedRoute><PasswordChangeRequired><NewOrder /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/order/edit/:orderId" element={<ProtectedRoute><PasswordChangeRequired><NewOrder /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><PasswordChangeRequired><History /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/order/:orderId" element={<ProtectedRoute><PasswordChangeRequired><OrderDetails /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/suppliers" element={<ProtectedRoute><PasswordChangeRequired><Suppliers /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute><PasswordChangeRequired><Products /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/consolidation-groups" element={<ProtectedRoute><PasswordChangeRequired><ConsolidationGroups /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute><PasswordChangeRequired><Customers /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/routes" element={<ProtectedRoute><PasswordChangeRequired><RoutesPage /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/driver-portal" element={<ProtectedRoute requiredRole="driver"><PasswordChangeRequired><DriverPortal /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/cif-calculator" element={<ProtectedRoute><PasswordChangeRequired><CIFCalculator /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/cif-calculator-history" element={<ProtectedRoute><PasswordChangeRequired><CIFCalculatorHistory /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/user-management" element={<ProtectedRoute requiredRole="admin"><PasswordChangeRequired><UserManagement /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/user-activity" element={<ProtectedRoute><PasswordChangeRequired><UserActivity /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/production" element={<ProtectedRoute><PasswordChangeRequired><ProductionDashboard /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/production-input" element={<ProtectedRoute><PasswordChangeRequired><ProductionInput /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/production-edit/:orderId" element={<ProtectedRoute><PasswordChangeRequired><ProductionEdit /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/deliveries" element={<ProtectedRoute><PasswordChangeRequired><DeliveryManagement /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute><PasswordChangeRequired><Invoices /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><PasswordChangeRequired><PredictionsAnalytics /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><PasswordChangeRequired><Settings /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/standing-orders" element={<ProtectedRoute><PasswordChangeRequired><StandingOrders /></PasswordChangeRequired></ProtectedRoute>} />
              {/* F&B Routes */}
              <Route path="/fnb" element={<ProtectedRoute><PasswordChangeRequired><FnbDashboard /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/products" element={<ProtectedRoute><PasswordChangeRequired><FnbProducts /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/customers" element={<ProtectedRoute><PasswordChangeRequired><FnbCustomers /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/orders" element={<ProtectedRoute><PasswordChangeRequired><FnbOrders /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/orders/new" element={<ProtectedRoute><PasswordChangeRequired><FnbNewOrder /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/orders/edit/:orderId" element={<ProtectedRoute><PasswordChangeRequired><FnbNewOrder /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/picker" element={<ProtectedRoute><PasswordChangeRequired><FnbPicker /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/picker/supervisor" element={<ProtectedRoute><PasswordChangeRequired><FnbPickerSupervisor /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/delivery" element={<ProtectedRoute><PasswordChangeRequired><FnbDeliveryManagement /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/driver-portal" element={<ProtectedRoute requiredRole="driver"><PasswordChangeRequired><FnbDriverPortal /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/cod" element={<ProtectedRoute><PasswordChangeRequired><FnbCODReconciliation /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/analytics" element={<ProtectedRoute><PasswordChangeRequired><FnbAnalytics /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/zones" element={<ProtectedRoute><PasswordChangeRequired><FnbZoneManagement /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/weekly" element={<ProtectedRoute><PasswordChangeRequired><FnbWeeklyBoard /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/receipts" element={<ProtectedRoute><PasswordChangeRequired><FnbReceiptVerification /></PasswordChangeRequired></ProtectedRoute>} />
              <Route path="/fnb/settings" element={<ProtectedRoute><PasswordChangeRequired><FnbSettings /></PasswordChangeRequired></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
