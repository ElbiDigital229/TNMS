import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./components/ui/Toast";
import ProtectedRoute from "./components/ProtectedRoute";
import RequirePermission from "./components/RequirePermission";
import DashboardLayout from "./components/layout/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import PropertyListPage from "./pages/PropertyListPage";
import PropertyFormPage from "./pages/PropertyFormPage";
import PropertyDetailPage from "./pages/PropertyDetailPage";
import AssetDetailPage from "./pages/AssetDetailPage";
import AssetsListPage from "./pages/AssetsListPage";
import AreaGroupSettingsPage from "./pages/AreaGroupSettingsPage";
import AssetCategoriesPage from "./pages/AssetCategoriesPage";
import TicketListPage from "./pages/TicketListPage";
import TicketFormPage from "./pages/TicketFormPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import TicketCategoriesPage from "./pages/TicketCategoriesPage";
import DashboardPage from "./pages/DashboardPage";
import TodoListPage from "./pages/TodoListPage";
import UserManagementPage from "./pages/UserManagementPage";
import RoleManagementPage from "./pages/RoleManagementPage";
import AuditLogPage from "./pages/AuditLogPage";
import ReportBuilderPage from "./pages/ReportBuilderPage";
import { PERMISSIONS } from "../../shared/permissions";

const P = PERMISSIONS;

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<RequirePermission permission={P.DASHBOARD.VIEW}><DashboardPage /></RequirePermission>} />
              <Route path="/properties" element={<RequirePermission permission={P.PROPERTIES.VIEW}><PropertyListPage /></RequirePermission>} />
              <Route path="/properties/new" element={<RequirePermission permission={P.PROPERTIES.CREATE}><PropertyFormPage /></RequirePermission>} />
              <Route path="/properties/:id" element={<RequirePermission permission={P.PROPERTIES.VIEW}><PropertyDetailPage /></RequirePermission>} />
              <Route path="/properties/:id/edit" element={<RequirePermission permission={P.PROPERTIES.EDIT}><PropertyFormPage /></RequirePermission>} />
              <Route path="/assets" element={<RequirePermission permission={P.ASSETS.VIEW}><AssetsListPage /></RequirePermission>} />
              <Route path="/todos" element={<RequirePermission permission={P.TODOS.ACCESS}><TodoListPage /></RequirePermission>} />
              <Route path="/assets/:code" element={<RequirePermission permission={P.ASSETS.VIEW}><AssetDetailPage /></RequirePermission>} />
              <Route path="/asset-view/:code" element={<RequirePermission permission={P.ASSETS.VIEW}><AssetDetailPage /></RequirePermission>} />
              <Route path="/tickets" element={<RequirePermission any={[P.TICKETS.VIEW_ALL, P.TICKETS.VIEW_ASSIGNED]}><TicketListPage /></RequirePermission>} />
              <Route path="/tickets/new" element={<RequirePermission permission={P.TICKETS.CREATE}><TicketFormPage /></RequirePermission>} />
              <Route path="/tickets/:id" element={<RequirePermission any={[P.TICKETS.VIEW_ALL, P.TICKETS.VIEW_ASSIGNED]}><TicketDetailPage /></RequirePermission>} />
              <Route path="/tickets/:id/edit" element={<RequirePermission permission={P.TICKETS.EDIT}><TicketFormPage /></RequirePermission>} />
              <Route path="/settings/area-groups" element={<RequirePermission permission={P.SETTINGS.AREA_GROUPS_MANAGE}><AreaGroupSettingsPage /></RequirePermission>} />
              <Route path="/settings/asset-categories" element={<RequirePermission permission={P.SETTINGS.ASSET_CATEGORIES_MANAGE}><AssetCategoriesPage /></RequirePermission>} />
              <Route path="/settings/ticket-categories" element={<RequirePermission permission={P.SETTINGS.TICKET_CATEGORIES_MANAGE}><TicketCategoriesPage /></RequirePermission>} />
              <Route path="/settings/users" element={<RequirePermission permission={P.USERS.VIEW}><UserManagementPage /></RequirePermission>} />
              <Route path="/settings/roles" element={<RequirePermission permission={P.ROLES.VIEW}><RoleManagementPage /></RequirePermission>} />
              <Route path="/reports" element={<RequirePermission permission={P.REPORTS.VIEW}><ReportBuilderPage /></RequirePermission>} />
              <Route path="/settings/audit-logs" element={<RequirePermission permission={P.AUDIT.VIEW}><AuditLogPage /></RequirePermission>} />
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
