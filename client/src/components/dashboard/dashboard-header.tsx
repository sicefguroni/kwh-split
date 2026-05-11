import { Home, LogOut, User, WifiOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  return (
    <header className="border-b border-ink-100/60 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Logo size="sm" className="lg:h-8 md:h-7 h-6" />
        </div>

        <div className="flex items-center gap-3">
          {!isOnline ? (
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-100 bg-ink-50 text-ink-700"
              title="Offline"
              aria-label="Offline"
            >
              <span className="sr-only">Offline</span>
              <WifiOff className="h-4 w-4 text-danger" aria-hidden />
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            aria-label="Home"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/profile")}
            aria-label="Profile"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </Button>
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
