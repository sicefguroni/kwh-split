import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { RealtimeUpdatesBridge } from "@/features/realtime/realtime-bridge";
import { ToastProvider, ToastContainer } from "@/components/ui/toast";
import { ProtectedRoute } from "@/routes/protected-route";
import { PublicOnlyRoute } from "@/routes/public-only-route";
import { AuthScreenFallback } from "@/components/layout/auth-screen-fallback";

const LandingPage = lazy(() => import("@/pages/landing"));
const LoginPage = lazy(() => import("@/pages/login"));
const SignupPage = lazy(() => import("@/pages/signup"));
const OauthCallbackPage = lazy(() => import("@/pages/oauth-callback"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const ExpenseDetailsPage = lazy(() => import("@/pages/expense-details"));
const GroupDetailsPage = lazy(() => import("@/pages/group-details"));
const JoinGroupPage = lazy(() => import("@/pages/join-group"));
const NotFoundPage = lazy(() => import("@/pages/not-found"));

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RealtimeUpdatesBridge />
        <BrowserRouter>
          <Suspense fallback={<AuthScreenFallback />}>
            <Routes>
              <Route element={<PublicOnlyRoute />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
              </Route>

              {/* OAuth callback must be outside PublicOnlyRoute — user is already authenticated when redirected here */}
              <Route path="/oauth/callback" element={<OauthCallbackPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/group/:groupId/expense/:expenseId" element={<ExpenseDetailsPage />} />
              <Route path="/group/:id" element={<GroupDetailsPage />} />
            </Route>

              {/* Public routes that may require auth */}
              <Route path="/join/:token" element={<JoinGroupPage />} />

              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <ToastContainer />
      </ToastProvider>
    </QueryClientProvider>
  );
}
