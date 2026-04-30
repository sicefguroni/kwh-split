import { LogOut, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

interface DashboardHeaderProps {
  onLogout: () => void;
  isLoggingOut: boolean;
  isOnline: boolean;
}

export function DashboardHeader({
  onLogout,
  isLoggingOut,
  isOnline,
}: DashboardHeaderProps) {
  const statusLabel = isOnline ? "Online" : "Offline";

  return (
    <header className="border-b border-ink-100/60 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Logo size="sm" className="h-12 sm:h-14" />
        </div>

        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-100 bg-ink-50 text-ink-700"
            title={statusLabel}
            aria-label={statusLabel}
          >
            <span className="sr-only">{statusLabel}</span>
            {isOnline ? (
              <Wifi className="h-4 w-4 text-success" aria-hidden />
            ) : (
              <WifiOff className="h-4 w-4 text-danger" aria-hidden />
            )}
          </span>
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
      </div>
    </header>
  );
}
