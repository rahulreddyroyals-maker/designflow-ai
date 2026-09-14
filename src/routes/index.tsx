import { createBrowserRouter } from "react-router-dom";

import AuthProvider from "@/components/layout/AuthProvider";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";

import LandingPage from "@/pages/Landing";
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import OnboardingPage from "@/pages/Onboarding";
import DashboardPage from "@/pages/Dashboard";
import ProjectsPage from "@/pages/Projects";
import NewProjectPage from "@/pages/NewProject";
import ProjectDetailPage from "@/pages/ProjectDetail";
import FloorPlanAnalyzerPage from "@/pages/FloorPlanAnalyzer";
import DesignWorkspacePage from "@/pages/DesignWorkspace";
import ProjectMaterialsPage from "@/pages/Materials";
import ConceptsPage from "@/pages/Concepts";
import PresentationPage from "@/pages/Presentation";
import ClientsPage from "@/pages/Clients";
import MaterialsLibraryPage from "@/pages/MaterialsLibrary";
import TeamPage from "@/pages/Team";
import SettingsPage from "@/pages/Settings";
import ShareViewPage from "@/pages/ShareView";
import NotFoundPage from "@/pages/NotFound";

/**
 * Route tree:
 *  - AuthProvider (root) initializes the session once for every route below.
 *  - Public routes: landing, auth, onboarding, client share links.
 *  - Protected branch: ProtectedRoute gates on session + company, AppShell
 *    renders the sidebar/topbar frame around every authenticated page.
 *
 * Route paths mirror docs/PRODUCT_SPEC.md.
 */
export const router = createBrowserRouter([
  {
    element: <AuthProvider />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/onboarding", element: <OnboardingPage /> },
      { path: "/share/:token", element: <ShareViewPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: "/dashboard", element: <DashboardPage /> },
              { path: "/projects", element: <ProjectsPage /> },
              { path: "/projects/new", element: <NewProjectPage /> },
              { path: "/projects/:id", element: <ProjectDetailPage /> },
              { path: "/projects/:id/analyze", element: <FloorPlanAnalyzerPage /> },
              { path: "/projects/:id/design", element: <DesignWorkspacePage /> },
              { path: "/projects/:id/rooms/:roomId", element: <DesignWorkspacePage /> },
              { path: "/projects/:id/materials", element: <ProjectMaterialsPage /> },
              { path: "/projects/:id/concepts", element: <ConceptsPage /> },
              { path: "/projects/:id/presentation", element: <PresentationPage /> },
              { path: "/clients", element: <ClientsPage /> },
              { path: "/materials", element: <MaterialsLibraryPage /> },
              { path: "/team", element: <TeamPage /> },
              { path: "/settings", element: <SettingsPage /> },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
