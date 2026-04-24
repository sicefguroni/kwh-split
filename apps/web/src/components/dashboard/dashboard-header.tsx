import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

interface DashboardHeaderProps {
  onLogout: () => void;
  isLoggingOut: boolean;
}

export function DashboardHeader({
  onLogout,
  isLoggingOut,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-ink-100/60 bg-mint-100/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="text-sm font-semibold text-ink-900">Split</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          disabled={isLoggingOut}
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Log out</span>
        </Button>
      </div>
    </header>
  );
}
