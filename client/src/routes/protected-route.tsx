import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useCurrentUser } from "@/features/auth/use-auth";
import { AuthScreenFallback } from "@/components/layout/auth-screen-fallback";

export function ProtectedRoute() {
  const location = useLocation();
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return <AuthScreenFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
