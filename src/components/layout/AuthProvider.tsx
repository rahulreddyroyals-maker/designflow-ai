import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

/**
 * Root layout element. Starts the auth session check + subscription exactly
 * once, then renders the rest of the route tree via <Outlet/>. Every route
 * (public and protected) lives under this so the store is always
 * initialized before ProtectedRoute reads its status.
 */
export default function AuthProvider() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <Outlet />;
}
