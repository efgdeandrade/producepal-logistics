import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import NewOrder from "./pages/NewOrder";
import History from "./pages/History";
import Suppliers from "./pages/Suppliers";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import RoutesPage from "./pages/Routes";
import DriverPortal from "./pages/DriverPortal";
import CIFCalculator from "./pages/CIFCalculator";
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";
import UserActivity from "./pages/UserActivity";
import ProductionDashboard from "./pages/ProductionDashboard";
import DeliveryManagement from "./pages/DeliveryManagement";
import PredictionsAnalytics from "./pages/PredictionsAnalytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/new-order" element={<ProtectedRoute><NewOrder /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/routes" element={<ProtectedRoute><RoutesPage /></ProtectedRoute>} />
            <Route path="/driver-portal" element={<ProtectedRoute requiredRole="driver"><DriverPortal /></ProtectedRoute>} />
            <Route path="/cif-calculator" element={<ProtectedRoute><CIFCalculator /></ProtectedRoute>} />
            <Route path="/user-management" element={<ProtectedRoute requiredRole="admin"><UserManagement /></ProtectedRoute>} />
            <Route path="/user-activity" element={<ProtectedRoute><UserActivity /></ProtectedRoute>} />
            <Route path="/production" element={<ProtectedRoute><ProductionDashboard /></ProtectedRoute>} />
            <Route path="/deliveries" element={<ProtectedRoute><DeliveryManagement /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><PredictionsAnalytics /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
