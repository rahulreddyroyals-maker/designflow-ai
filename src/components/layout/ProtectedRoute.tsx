import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Gates every authenticated route. Redirects to /login (preserving the
 * attempted location) when there's no session, and to /onboarding when the
 * user is authenticated but has no company yet (see authStore's
 * "needs_company" status).
 */
export default function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-3 w-64">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (status === "error") {
    return (
      <div className="flex h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="font-medium text-destructive">Something went wrong loading your account.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try refreshing the page. If this keeps happening, contact support.
          </p>
        </div>
      </div>
    );
  }

  if (status === "needs_company") {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
