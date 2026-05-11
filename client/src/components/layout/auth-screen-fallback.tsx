import { Logo } from "@/components/brand/logo";

export function AuthScreenFallback() {
  return (
    <main className="grid min-h-[100svh] place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-ink-500">
        <Logo size="md" className="h-[3.5rem] w-auto sm:h-[3rem]" />
      </div>
    </main>
  );
}
