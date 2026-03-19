import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PasswordChangeRequired } from "@/components/PasswordChangeRequired";
import { VersionUpdateToast } from "@/components/VersionUpdateToast";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Portal Layouts
import { DistributionLayout } from "@/layouts/DistributionLayout";
import { LogisticsLayout } from "@/layouts/LogisticsLayout";
import { ProductionLayout } from "@/layouts/ProductionLayout";
import { HRLayout } from "@/layouts/HRLayout";
import { ImportLayout } from "@/layouts/ImportLayout";
import { AdminLayout } from "@/layouts/AdminLayout";

// Portal Selector
import PortalSelector from "./pages/PortalSelector";

// Admin/Executive Pages
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import UserManagement from "./pages/UserManagement";
import UserActivity from "./pages/UserActivity";
import ReportLibrary from "./pages/ReportLibrary";
import ScheduledReports from "./pages/ScheduledReports";
import Settings from "./pages/Settings";
import IntegrationHub from "./pages/integrations/IntegrationHub";
import GmailSettings from "./pages/integrations/GmailSettings";
import WhatsAppSettings from "./pages/integrations/WhatsAppSettings";
import QuickBooksSync from "./pages/integrations/QuickBooksSync";
import QuickBooksConnect from "./pages/integrations/QuickBooksConnect";
import WebhookManager from "./pages/integrations/WebhookManager";
import ApiConnectors from "./pages/integrations/ApiConnectors";

// Import Department
import ImportDashboard from "./pages/ImportDashboard";
import NewOrder from "./pages/NewOrder";
import History from "./pages/History";
import OrderDetails from "./pages/OrderDetails";
import Suppliers from "./pages/Suppliers";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import ConsolidationGroups from "./pages/ConsolidationGroups";
import StandingOrders from "./pages/StandingOrders";
import ImportEmailTemplates from "./pages/import/ImportEmailTemplates";
import ImportBills from "./pages/import/ImportBills";
import ImportShipments from "./pages/import/ImportShipments";
import ImportDocuments from "./pages/import/ImportDocuments";
import ImportAnalytics from "./pages/import/ImportAnalytics";
import ImportCIFCalculator from "./pages/import/ImportCIFCalculator";
import ImportCIFReports from "./pages/import/ImportCIFReports";
import ImportCIFBackfill from "./pages/import/ImportCIFBackfill";

// Distribution Department
import DistributionDashboard from "./pages/DistributionDashboard";
import FnbProducts from "./pages/fnb/FnbProducts";
import FnbCustomers from "./pages/fnb/FnbCustomers";
import FnbOrders from "./pages/fnb/FnbOrders";
import FnbNewOrder from "./pages/fnb/FnbNewOrder";
import FnbPicker from "./pages/fnb/FnbPicker";
import FnbPickerSupervisor from "./pages/fnb/FnbPickerSupervisor";
import FnbCODReconciliation from "./pages/fnb/FnbCODReconciliation";
import FnbAnalytics from "./pages/fnb/FnbAnalytics";
import FnbZoneManagement from "./pages/fnb/FnbZoneManagement";
import FnbWeeklyBoard from "./pages/fnb/FnbWeeklyBoard";
import FnbReceiptVerification from "./pages/fnb/FnbReceiptVerification";
import FnbStandingOrders from "./pages/fnb/FnbStandingOrders";
import FnbPricingTiers from "./pages/fnb/FnbPricingTiers";
import FnbSettings from "./pages/fnb/FnbSettings";
import FnbQuickPaste from "./pages/fnb/FnbQuickPaste";
import FnbTrainingHub from "./pages/fnb/FnbTrainingHub";
import FnbInvoices from "./pages/fnb/FnbInvoices";
import FnbInvoiceDetail from "./pages/fnb/FnbInvoiceDetail";
import FnbEmailInbox from "./pages/fnb/FnbEmailInbox";
import FnbEmailTemplates from "./pages/fnb/FnbEmailTemplates";
import FnbWhatsAppInbox from "./pages/fnb/FnbWhatsAppInbox";
import FnbDreCommandCenter from "./pages/fnb/FnbDreCommandCenter";
import FnbDreMobile from "./pages/fnb/FnbDreMobile";
import DreApp from "./pages/DreApp";
import FnbDreAnalytics from "./pages/fnb/FnbDreAnalytics";
import PapiamentuTraining from "./pages/fnb/PapiamentuTraining";

// Logistics/Driver
import LogisticsDashboard from "./pages/LogisticsDashboard";
import RoutesPage from "./pages/Routes";
import DeliveryManagement from "./pages/DeliveryManagement";
import Invoices from "./pages/Invoices";
import FnbDriverPortal from "./pages/fnb/FnbDriverPortal";
import FnbDriverMobile from "./pages/fnb/FnbDriverMobile";
import FnbDriverSchedule from "./pages/fnb/FnbDriverSchedule";
import FnbDispatch from "./pages/fnb/FnbDispatch";
import FnbDriverZones from "./pages/fnb/FnbDriverZones";

// Production Department
import ProductionDashboardNew from "./pages/ProductionDashboardNew";
import ProductionDashboard from "./pages/ProductionDashboard";
import ProductionInput from "./pages/ProductionInput";
import ProductionEdit from "./pages/ProductionEdit";

// HR Department
import HRDashboard from "./pages/hr/HRDashboard";
import Employees from "./pages/hr/Employees";
import TimeAttendance from "./pages/hr/TimeAttendance";
import Timesheets from "./pages/hr/Timesheets";
import Documents from "./pages/hr/Documents";
import HRPayroll from "./pages/hr/HRPayroll";

// Production Stock
import ProductionStock from "./pages/production/ProductionStock";

// Public/Auth Pages
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import Offline from "./pages/Offline";
import ResetPassword from "./pages/ResetPassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import EULA from "./pages/EULA";
import SetupProfile from "./pages/SetupProfile";

// Intake Portal
import { IntakeLayout } from "@/layouts/IntakeLayout";
import IntakeConversations from "./pages/intake/IntakeConversations";
import IntakeEmailPO from "./pages/intake/IntakeEmailPO";
import IntakeShopifyOrders from "./pages/intake/IntakeShopifyOrders";
import IntakeProducts from "./pages/intake/IntakeProducts";
import IntakeSettings from "./pages/intake/IntakeSettings";

// Finance & Marketing Portals
import FinancePortal from "./pages/finance/FinancePortal";
import MarketingPortal from "./pages/marketing/MarketingPortal";

// Administration & R&D Portals
import AdminPortalPage from "./pages/admin/AdminPortal";
import RDPortal from "./pages/rd/RDPortal";

const queryClient = new QueryClient();

// Layout wrapper components for each portal
const ProtectedDistribution = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <PasswordChangeRequired>
      <DistributionLayout>{children}</DistributionLayout>
    </PasswordChangeRequired>
  </ProtectedRoute>
);

const ProtectedLogistics = ({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) => (
  <ProtectedRoute requiredRole={requiredRole}>
    <PasswordChangeRequired>
      <LogisticsLayout>{children}</LogisticsLayout>
    </PasswordChangeRequired>
  </ProtectedRoute>
);

const ProtectedProduction = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <PasswordChangeRequired>
      <ProductionLayout>{children}</ProductionLayout>
    </PasswordChangeRequired>
  </ProtectedRoute>
);

const ProtectedHR = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <PasswordChangeRequired>
      <HRLayout>{children}</HRLayout>
    </PasswordChangeRequired>
  </ProtectedRoute>
);

const ProtectedImport = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <PasswordChangeRequired>
      <ImportLayout>{children}</ImportLayout>
    </PasswordChangeRequired>
  </ProtectedRoute>
);

const ProtectedAdmin = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requiredRole="admin">
    <PasswordChangeRequired>
      <AdminLayout>{children}</AdminLayout>
    </PasswordChangeRequired>
  </ProtectedRoute>
);

const ProtectedIntake = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <PasswordChangeRequired>
      <IntakeLayout>{children}</IntakeLayout>
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
    return <Offline />;
  }

  return <>{children}</>;
};

// Global handler to prevent unhandled promise rejections from crashing the app
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Prevent the default browser behavior (showing error in console as uncaught)
    event.preventDefault();
  });
}

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
                <Routes>
                  {/* ========== PUBLIC ROUTES ========== */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/install" element={<Install />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/eula" element={<EULA />} />

                  {/* ========== PORTAL SELECTOR (Entry Point) ========== */}
                  <Route path="/" element={
                    <ProtectedRoute>
                      <PasswordChangeRequired>
                        <PortalSelector />
                      </PasswordChangeRequired>
                    </ProtectedRoute>
                  } />
                  <Route path="/select-portal" element={
                    <ProtectedRoute>
                      <PasswordChangeRequired>
                        <PortalSelector />
                      </PasswordChangeRequired>
                    </ProtectedRoute>
                  } />

                  {/* ========== SETUP PROFILE ========== */}
                  <Route path="/setup" element={
                    <ProtectedRoute>
                      <SetupProfile />
                    </ProtectedRoute>
                  } />

                  {/* ========== INTAKE PORTAL ========== */}
                  <Route path="/intake" element={<ProtectedIntake><IntakeConversations /></ProtectedIntake>} />
                  <Route path="/intake/conversations" element={<ProtectedIntake><IntakeConversations /></ProtectedIntake>} />
                  <Route path="/intake/email-po" element={<ProtectedIntake><IntakeEmailPO /></ProtectedIntake>} />
                  <Route path="/intake/shopify" element={<ProtectedIntake><IntakeShopifyOrders /></ProtectedIntake>} />
                  <Route path="/intake/products" element={<ProtectedIntake><IntakeProducts /></ProtectedIntake>} />
                  <Route path="/intake/settings" element={<ProtectedIntake><IntakeSettings /></ProtectedIntake>} />

                  {/* ========== FINANCE PORTAL ========== */}
                  <Route path="/finance" element={
                    <ProtectedRoute>
                      <PasswordChangeRequired>
                        <FinancePortal />
                      </PasswordChangeRequired>
                    </ProtectedRoute>
                  } />

                  {/* ========== MARKETING PORTAL ========== */}
                  <Route path="/marketing" element={
                    <ProtectedRoute>
                      <PasswordChangeRequired>
                        <MarketingPortal />
                      </PasswordChangeRequired>
                    </ProtectedRoute>
                  } />

                  {/* ========== ADMINISTRATION PORTAL ========== */}
                  <Route path="/administration" element={
                    <ProtectedRoute>
                      <PasswordChangeRequired>
                        <AdminPortalPage />
                      </PasswordChangeRequired>
                    </ProtectedRoute>
                  } />

                  {/* ========== R&D PORTAL ========== */}
                  <Route path="/rd" element={
                    <ProtectedRoute>
                      <PasswordChangeRequired>
                        <RDPortal />
                      </PasswordChangeRequired>
                    </ProtectedRoute>
                  } />

                  {/* ========== STANDALONE APPS ========== */}
                  <Route path="/dre" element={
                    <ProtectedRoute>
                      <PasswordChangeRequired>
                        <DreApp />
                      </PasswordChangeRequired>
                    </ProtectedRoute>
                  } />

                  {/* ========== DRIVER PORTAL (Standalone PWA) ========== */}
                  <Route path="/driver" element={
                    <ProtectedRoute requiredRole="driver">
                      <PasswordChangeRequired>
                        <FnbDriverMobile />
                      </PasswordChangeRequired>
                    </ProtectedRoute>
                  } />

                  {/* ========== ADMIN PORTAL ========== */}
                  <Route path="/admin" element={<ProtectedAdmin><ExecutiveDashboard /></ProtectedAdmin>} />
                  <Route path="/admin/users" element={<ProtectedAdmin><UserManagement /></ProtectedAdmin>} />
                  <Route path="/admin/activity" element={<ProtectedAdmin><UserActivity /></ProtectedAdmin>} />
                  <Route path="/admin/reports" element={<ProtectedAdmin><ReportLibrary /></ProtectedAdmin>} />
                  <Route path="/admin/scheduled-reports" element={<ProtectedAdmin><ScheduledReports /></ProtectedAdmin>} />
                  <Route path="/admin/settings" element={<ProtectedAdmin><Settings /></ProtectedAdmin>} />
                  <Route path="/admin/integrations" element={<ProtectedAdmin><IntegrationHub /></ProtectedAdmin>} />
                  <Route path="/admin/integrations/gmail" element={<ProtectedAdmin><GmailSettings /></ProtectedAdmin>} />
                  <Route path="/admin/integrations/whatsapp" element={<ProtectedAdmin><WhatsAppSettings /></ProtectedAdmin>} />
                  <Route path="/admin/integrations/quickbooks" element={<ProtectedAdmin><QuickBooksSync /></ProtectedAdmin>} />
                  <Route path="/admin/integrations/quickbooks/connect" element={<ProtectedAdmin><QuickBooksConnect /></ProtectedAdmin>} />
                  <Route path="/admin/integrations/webhooks" element={<ProtectedAdmin><WebhookManager /></ProtectedAdmin>} />
                  <Route path="/admin/integrations/api" element={<ProtectedAdmin><ApiConnectors /></ProtectedAdmin>} />

                  {/* ========== IMPORT PORTAL ========== */}
                  <Route path="/import" element={<ProtectedImport><ImportDashboard /></ProtectedImport>} />
                  <Route path="/import/orders" element={<ProtectedImport><History /></ProtectedImport>} />
                  <Route path="/import/orders/new" element={<ProtectedImport><NewOrder /></ProtectedImport>} />
                  <Route path="/import/orders/edit/:orderId" element={<ProtectedImport><NewOrder /></ProtectedImport>} />
                  <Route path="/import/orders/:orderId" element={<ProtectedImport><OrderDetails /></ProtectedImport>} />
                  <Route path="/import/standing-orders" element={<ProtectedImport><StandingOrders /></ProtectedImport>} />
                  <Route path="/import/suppliers" element={<ProtectedImport><Suppliers /></ProtectedImport>} />
                  <Route path="/import/products" element={<ProtectedImport><Products /></ProtectedImport>} />
                  <Route path="/import/customers" element={<ProtectedImport><Customers /></ProtectedImport>} />
                  <Route path="/import/consolidation-groups" element={<ProtectedImport><ConsolidationGroups /></ProtectedImport>} />
                  <Route path="/import/invoices" element={<ProtectedImport><Invoices /></ProtectedImport>} />
                  <Route path="/import/bills" element={<ProtectedImport><ImportBills /></ProtectedImport>} />
                  <Route path="/import/shipments" element={<ProtectedImport><ImportShipments /></ProtectedImport>} />
                  <Route path="/import/documents" element={<ProtectedImport><ImportDocuments /></ProtectedImport>} />
                  <Route path="/import/analytics" element={<ProtectedImport><ImportAnalytics /></ProtectedImport>} />
                  <Route path="/import/cif-calculator" element={<ProtectedImport><ImportCIFCalculator /></ProtectedImport>} />
                  <Route path="/import/cif-reports" element={<ProtectedImport><ImportCIFReports /></ProtectedImport>} />
                  <Route path="/import/cif-backfill" element={<ProtectedImport><ImportCIFBackfill /></ProtectedImport>} />
                  <Route path="/import/email-templates" element={<ProtectedImport><ImportEmailTemplates /></ProtectedImport>} />

                  {/* ========== DISTRIBUTION PORTAL ========== */}
                  <Route path="/distribution" element={<ProtectedDistribution><DistributionDashboard /></ProtectedDistribution>} />
                  <Route path="/distribution/orders" element={<ProtectedDistribution><FnbOrders /></ProtectedDistribution>} />
                  <Route path="/distribution/orders/new" element={<ProtectedDistribution><FnbNewOrder /></ProtectedDistribution>} />
                  <Route path="/distribution/orders/edit/:orderId" element={<ProtectedDistribution><FnbNewOrder /></ProtectedDistribution>} />
                  <Route path="/distribution/weekly" element={<ProtectedDistribution><FnbWeeklyBoard /></ProtectedDistribution>} />
                  <Route path="/distribution/standing-orders" element={<ProtectedDistribution><FnbStandingOrders /></ProtectedDistribution>} />
                  <Route path="/distribution/picker" element={<ProtectedDistribution><FnbPicker /></ProtectedDistribution>} />
                  <Route path="/distribution/picker/:orderId" element={<ProtectedDistribution><FnbPicker /></ProtectedDistribution>} />
                  <Route path="/distribution/picker/supervisor" element={<ProtectedDistribution><FnbPickerSupervisor /></ProtectedDistribution>} />
                  <Route path="/distribution/receipts" element={<ProtectedDistribution><FnbReceiptVerification /></ProtectedDistribution>} />
                  <Route path="/distribution/customers" element={<ProtectedDistribution><FnbCustomers /></ProtectedDistribution>} />
                  <Route path="/distribution/products" element={<ProtectedDistribution><FnbProducts /></ProtectedDistribution>} />
                  <Route path="/distribution/pricing" element={<ProtectedDistribution><FnbPricingTiers /></ProtectedDistribution>} />
                  <Route path="/distribution/zones" element={<ProtectedDistribution><FnbZoneManagement /></ProtectedDistribution>} />
                  <Route path="/distribution/cod" element={<ProtectedDistribution><FnbCODReconciliation /></ProtectedDistribution>} />
                  <Route path="/distribution/analytics" element={<ProtectedDistribution><FnbAnalytics /></ProtectedDistribution>} />
                  <Route path="/distribution/settings" element={<ProtectedDistribution><FnbSettings /></ProtectedDistribution>} />
                  <Route path="/distribution/training" element={<ProtectedDistribution><FnbTrainingHub /></ProtectedDistribution>} />
                  <Route path="/distribution/invoices" element={<ProtectedDistribution><FnbInvoices /></ProtectedDistribution>} />
                  <Route path="/distribution/invoices/:invoiceId" element={<ProtectedDistribution><FnbInvoiceDetail /></ProtectedDistribution>} />
                  <Route path="/distribution/email-inbox" element={<ProtectedDistribution><FnbEmailInbox /></ProtectedDistribution>} />
                  <Route path="/distribution/email-templates" element={<ProtectedDistribution><FnbEmailTemplates /></ProtectedDistribution>} />
                  <Route path="/distribution/whatsapp-inbox" element={<ProtectedDistribution><FnbWhatsAppInbox /></ProtectedDistribution>} />
                  <Route path="/distribution/dre-command-center" element={<ProtectedDistribution><FnbDreCommandCenter /></ProtectedDistribution>} />
                  <Route path="/distribution/dre-mobile" element={<ProtectedDistribution><FnbDreMobile /></ProtectedDistribution>} />
                  <Route path="/distribution/dre-analytics" element={<ProtectedDistribution><FnbDreAnalytics /></ProtectedDistribution>} />
                  <Route path="/distribution/papiamentu-training" element={<ProtectedDistribution><PapiamentuTraining /></ProtectedDistribution>} />
                  <Route path="/quick-paste" element={<ProtectedDistribution><FnbQuickPaste /></ProtectedDistribution>} />

                  {/* ========== LOGISTICS PORTAL ========== */}
                  <Route path="/logistics" element={<ProtectedLogistics><LogisticsDashboard /></ProtectedLogistics>} />
                  <Route path="/logistics/dispatch" element={<ProtectedLogistics><FnbDispatch /></ProtectedLogistics>} />
                  <Route path="/logistics/routes" element={<ProtectedLogistics><RoutesPage /></ProtectedLogistics>} />
                  <Route path="/logistics/schedule" element={<ProtectedLogistics><FnbDriverSchedule /></ProtectedLogistics>} />
                  <Route path="/logistics/driver-zones" element={<ProtectedLogistics><FnbDriverZones /></ProtectedLogistics>} />
                  <Route path="/logistics/deliveries" element={<ProtectedLogistics><DeliveryManagement /></ProtectedLogistics>} />
                  <Route path="/logistics/invoices" element={<ProtectedLogistics><Invoices /></ProtectedLogistics>} />
                  <Route path="/logistics/driver-portal" element={<ProtectedLogistics requiredRole="driver"><FnbDriverPortal /></ProtectedLogistics>} />
                  <Route path="/logistics/driver-mobile" element={<ProtectedLogistics requiredRole="driver"><FnbDriverMobile /></ProtectedLogistics>} />

                  {/* ========== PRODUCTION PORTAL ========== */}
                  <Route path="/production" element={<ProtectedProduction><ProductionDashboardNew /></ProtectedProduction>} />
                  <Route path="/production/dashboard" element={<ProtectedProduction><ProductionDashboard /></ProtectedProduction>} />
                  <Route path="/production/input" element={<ProtectedProduction><ProductionInput /></ProtectedProduction>} />
                  <Route path="/production/edit/:orderId" element={<ProtectedProduction><ProductionEdit /></ProtectedProduction>} />
                  <Route path="/production/stock" element={<ProtectedProduction><ProductionStock /></ProtectedProduction>} />

                  {/* ========== HR PORTAL ========== */}
                  <Route path="/hr" element={<ProtectedHR><HRDashboard /></ProtectedHR>} />
                  <Route path="/hr/employees" element={<ProtectedHR><Employees /></ProtectedHR>} />
                  <Route path="/hr/attendance" element={<ProtectedHR><TimeAttendance /></ProtectedHR>} />
                  <Route path="/hr/timesheets" element={<ProtectedHR><Timesheets /></ProtectedHR>} />
                  <Route path="/hr/documents" element={<ProtectedHR><Documents /></ProtectedHR>} />
                  <Route path="/hr/payroll" element={<ProtectedHR><HRPayroll /></ProtectedHR>} />

                  {/* ========== Catch-all: redirect to portal selector ========== */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </OfflineWrapper>
          </ErrorBoundary>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
