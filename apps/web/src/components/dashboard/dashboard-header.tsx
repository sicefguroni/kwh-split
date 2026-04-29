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
  return (
    <header className="border-b border-ink-100/60 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="text-sm font-semibold text-ink-900">Split</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-ink-50 px-3 py-1 text-xs font-semibold text-ink-700">
            {isOnline ? <Wifi className="h-3.5 w-3.5 text-success" /> : <WifiOff className="h-3.5 w-3.5 text-danger" />}
            {isOnline ? "Online" : "Offline"}
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
      </div>
    </header>
  );
}
