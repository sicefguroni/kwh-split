import { Logo } from "@/components/brand/logo";
import { Spinner } from "@/components/ui/spinner";

export function AuthScreenFallback() {
  return (
    <main className="grid min-h-[100svh] place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-ink-500">
        <Logo size="md" className="h-[5.25rem] w-auto sm:h-[6rem]" />
        <Spinner className="text-ink-500" label="Loading Split" />
      </div>
    </main>
  );
}
