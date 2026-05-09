import { Link, useLocation } from "react-router-dom";
import { AuthLayout } from "@/components/layout/auth-layout";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirect = params.get("redirect");
  const email = params.get("email");
  const signupParams = new URLSearchParams();
  if (redirect) {
    signupParams.set("redirect", redirect);
  }
  if (email) {
    signupParams.set("email", email);
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage your group expenses"
      footer={
        <span>
          Don&apos;t have an account?{" "}
          <Link
            to={signupParams.size > 0 ? `/signup?${signupParams.toString()}` : "/signup"}
            className="font-medium text-ink-900 underline underline-offset-4"
          >
            Sign up
          </Link>
        </span>
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}
