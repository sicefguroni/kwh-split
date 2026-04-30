import { Link } from "react-router-dom";
import { AuthLayout } from "@/components/layout/auth-layout";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage your group expenses"
      footer={
        <span>
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
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
