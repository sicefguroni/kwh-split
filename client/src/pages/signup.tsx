import { Link, useLocation } from "react-router-dom";
import { AuthLayout } from "@/components/layout/auth-layout";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirect = params.get("redirect");
  const email = params.get("email");
  const loginParams = new URLSearchParams();
  if (redirect) {
    loginParams.set("redirect", redirect);
  }
  if (email) {
    loginParams.set("email", email);
  }

  return (
    <AuthLayout
      title="Create your Split"
      subtitle="Start tracking group expenses in minutes"
      footer={
        <span>
          Already a user?{" "}
          <Link
            to={loginParams.size > 0 ? `/login?${loginParams.toString()}` : "/login"}
            className="font-medium text-ink-900 underline underline-offset-4"
          >
            Log in
          </Link>
        </span>
      }
    >
      <SignupForm />
    </AuthLayout>
  );
}
