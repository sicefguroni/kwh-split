import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function LandingPage() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
      <Logo size="lg" className="mb-6" />
      <h1 className="text-3xl font-semibold text-ink-900 sm:text-4xl">
        Track group expenses without the drama
      </h1>
      <p className="mt-3 max-w-md text-base text-ink-500">
        Split keeps every shared bill transparent and up to date so your group
        always knows who owes what.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-sm sm:flex-row">
        <Button asChild size="lg" fullWidth>
          <Link to="/signup">Get started</Link>
        </Button>
        <Button asChild variant="secondary" size="lg" fullWidth>
          <Link to="/login">Log in</Link>
        </Button>
      </div>
    </main>
  );
}
