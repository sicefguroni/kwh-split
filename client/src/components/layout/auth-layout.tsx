import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: AuthLayoutProps) {
  return (
    <main className="flex min-h-[100svh] items-center justify-center px-4 py-10 sm:py-16">
      <section className="w-full max-w-md">
        <header className="mb-6 flex flex-col items-center text-center">
          <Logo size="lg" className="mb-5 h-[3.5rem] w-auto sm:h-[3rem]" />
          <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
          ) : null}
        </header>

        <div className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(10,15,26,0.04),0_16px_40px_-24px_rgba(10,15,26,0.2)] sm:p-8">
          {children}
        </div>

        {footer ? (
          <footer className="mt-6 text-center text-sm text-ink-500">
            {footer}
          </footer>
        ) : null}
      </section>
    </main>
  );
}
