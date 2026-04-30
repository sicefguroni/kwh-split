import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-[100svh] place-items-center px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <Logo size="md" className="h-[5.25rem] w-auto sm:h-[6rem]" />
        <h1 className="text-2xl font-semibold text-ink-900">Page not found</h1>
        <p className="max-w-sm text-sm text-ink-500">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Button asChild>
          <Link to="/">Back to Split</Link>
        </Button>
      </div>
    </main>
  );
}
