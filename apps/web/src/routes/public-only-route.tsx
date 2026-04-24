import { Navigate, Outlet } from "react-router-dom";
import { useCurrentUser } from "@/features/auth/use-auth";
import { AuthScreenFallback } from "@/components/layout/auth-screen-fallback";

export function PublicOnlyRoute() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return <AuthScreenFallback />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
