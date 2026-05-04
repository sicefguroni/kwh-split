import { Link } from "react-router-dom";
import { AuthLayout } from "@/components/layout/auth-layout";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <AuthLayout
      title="Create your Split"
      subtitle="Start tracking group expenses in minutes"
      footer={
        <span>
          Already a user?{" "}
          <Link
            to="/login"
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
