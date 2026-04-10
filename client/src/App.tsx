import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./components/ui/Toast";
import ProtectedRoute from "./components/ProtectedRoute";
import RequirePermission from "./components/RequirePermission";
import DashboardLayout from "./components/layout/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

// Lazy-load everything that isn't on the initial critical path. The login
// screen and the dashboard stay in the main bundle because they're what
// users see first. Everything else is code-split so the initial download
// stays small.
const PropertyListPage = lazy(() => import("./pages/PropertyListPage"));
const PropertyFormPage = lazy(() => import("./pages/PropertyFormPage"));
const PropertyDetailPage = lazy(() => import("./pages/PropertyDetailPage"));
const AssetDetailPage = lazy(() => import("./pages/AssetDetailPage"));
const AssetsListPage = lazy(() => import("./pages/AssetsListPage"));
const UnitListPage = lazy(() => import("./pages/UnitListPage"));
const AreaGroupSettingsPage = lazy(() => import("./pages/AreaGroupSettingsPage"));
const AssetCategoriesPage = lazy(() => import("./pages/AssetCategoriesPage"));
const TicketListPage = lazy(() => import("./pages/TicketListPage"));
const TicketFormPage = lazy(() => import("./pages/TicketFormPage"));
const TicketDetailPage = lazy(() => import("./pages/TicketDetailPage"));
const TicketCategoriesPage = lazy(() => import("./pages/TicketCategoriesPage"));
const TicketSchedulesPage = lazy(() => import("./pages/TicketSchedulesPage"));
const DepartmentsPage = lazy(() => import("./pages/DepartmentsPage"));
const DesignationsPage = lazy(() => import("./pages/DesignationsPage"));
const TodoListPage = lazy(() => import("./pages/TodoListPage"));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));
const RoleManagementPage = lazy(() => import("./pages/RoleManagementPage"));
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));
const ReportPage = lazy(() => import("./pages/ReportPage"));
const ReportBuilderPage = lazy(() => import("./pages/ReportBuilderPage"));
const EntityReportPage = lazy(() => import("./pages/EntityReportPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));

function PageFallback() {
  return null;
}
import { NotificationProvider } from "./contexts/NotificationContext";
import { PERMISSIONS } from "../../shared/permissions";
import { useAuth } from "./contexts/AuthContext";

const P = PERMISSIONS;

function SmartRedirect() {
  const { hasPermission, hasAnyPermission } = useAuth();

  // Same order as sidebar
  if (hasPermission(P.DASHBOARD.VIEW)) return <DashboardPage />;
  if (hasAnyPermission(P.TICKETS.VIEW_ALL, P.TICKETS.VIEW_ASSIGNED)) return <Navigate to="/tickets" replace />;
  if (hasPermission(P.PROPERTIES.VIEW)) return <Navigate to="/properties" replace />;
  if (hasPermission(P.ASSETS.VIEW)) return <Navigate to="/assets" replace />;
  if (hasPermission(P.TODOS.ACCESS)) return <Navigate to="/todos" replace />;
  if (hasPermission(P.REPORTS.VIEW)) return <Navigate to="/reports" replace />;
  return <Navigate to="/notifications" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <NotificationProvider>
        <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<SmartRedirect />} />
              <Route path="/properties" element={<RequirePermission permission={P.PROPERTIES.VIEW}><PropertyListPage /></RequirePermission>} />
              <Route path="/properties/new" element={<RequirePermission permission={P.PROPERTIES.CREATE}><PropertyFormPage /></RequirePermission>} />
              <Route path="/properties/:id" element={<RequirePermission permission={P.PROPERTIES.VIEW}><PropertyDetailPage /></RequirePermission>} />
              <Route path="/properties/:id/edit" element={<RequirePermission permission={P.PROPERTIES.EDIT}><PropertyFormPage /></RequirePermission>} />
              <Route path="/assets" element={<RequirePermission permission={P.ASSETS.VIEW}><AssetsListPage /></RequirePermission>} />
              <Route path="/units" element={<RequirePermission permission={P.UNITS.VIEW}><UnitListPage /></RequirePermission>} />
              <Route path="/todos" element={<RequirePermission permission={P.TODOS.ACCESS}><TodoListPage /></RequirePermission>} />
              <Route path="/assets/:code" element={<RequirePermission permission={P.ASSETS.VIEW}><AssetDetailPage /></RequirePermission>} />
              <Route path="/asset-view/:code" element={<RequirePermission permission={P.ASSETS.VIEW}><AssetDetailPage /></RequirePermission>} />
              <Route path="/tickets" element={<RequirePermission any={[P.TICKETS.VIEW_ALL, P.TICKETS.VIEW_ASSIGNED]}><TicketListPage /></RequirePermission>} />
              <Route path="/tickets/new" element={<RequirePermission permission={P.TICKETS.CREATE}><TicketFormPage /></RequirePermission>} />
              <Route path="/tickets/:id" element={<RequirePermission any={[P.TICKETS.VIEW_ALL, P.TICKETS.VIEW_ASSIGNED]}><TicketDetailPage /></RequirePermission>} />
              <Route path="/tickets/:id/edit" element={<RequirePermission permission={P.TICKETS.EDIT}><TicketFormPage /></RequirePermission>} />
              <Route path="/ticket-schedules" element={<RequirePermission permission={P.TICKETS.CREATE}><TicketSchedulesPage /></RequirePermission>} />
              <Route path="/settings/area-groups" element={<RequirePermission permission={P.SETTINGS.AREA_GROUPS_MANAGE}><AreaGroupSettingsPage /></RequirePermission>} />
              <Route path="/settings/asset-categories" element={<RequirePermission permission={P.SETTINGS.ASSET_CATEGORIES_MANAGE}><AssetCategoriesPage /></RequirePermission>} />
              <Route path="/settings/ticket-categories" element={<RequirePermission permission={P.SETTINGS.TICKET_CATEGORIES_MANAGE}><TicketCategoriesPage /></RequirePermission>} />
              <Route path="/settings/departments" element={<RequirePermission permission={P.SETTINGS.DEPARTMENTS_MANAGE}><DepartmentsPage /></RequirePermission>} />
              <Route path="/settings/designations" element={<RequirePermission permission={P.SETTINGS.DESIGNATIONS_MANAGE}><DesignationsPage /></RequirePermission>} />
              <Route path="/settings/users" element={<RequirePermission permission={P.USERS.VIEW}><UserManagementPage /></RequirePermission>} />
              <Route path="/settings/roles" element={<RequirePermission permission={P.ROLES.VIEW}><RoleManagementPage /></RequirePermission>} />
              <Route path="/reports" element={<RequirePermission permission={P.REPORTS.VIEW}><ReportPage /></RequirePermission>} />
              <Route path="/reports/builder" element={<RequirePermission permission={P.REPORTS.VIEW}><ReportBuilderPage /></RequirePermission>} />
              <Route path="/reports/:entityType/:entityId" element={<RequirePermission permission={P.REPORTS.VIEW}><EntityReportPage /></RequirePermission>} />
              <Route path="/settings/audit-logs" element={<RequirePermission permission={P.AUDIT.VIEW}><AuditLogPage /></RequirePermission>} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>
          </Route>
        </Routes>
        </Suspense>
        </NotificationProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
