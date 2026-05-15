import { NotificationCenter } from "@/components/dashboard/notification-center";
import { Home, LogOut, User, WifiOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

interface DashboardHeaderProps {
  onLogout: () => void;
  isLoggingOut: boolean;
  isOnline: boolean;
  actionMessage?: { kind: "success" | "error"; text: string } | null;
  onDismissAction?: () => void;
  deletedGroupNotification?: string | null;
  onDismissDeletedNotification?: () => void;
  showHome?: boolean;
}

export function DashboardHeader({
  onLogout,
  isLoggingOut,
  isOnline,
  actionMessage,
  onDismissAction,
  deletedGroupNotification,
  onDismissDeletedNotification,
  showHome = true,
}: DashboardHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100/60 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 sm:px-6">

        {/* Left: Logo + Home */}
        <div className="flex items-center gap-3">
          <Logo size="sm" className="h-6 md:h-7 lg:h-8" />
          {deletedGroupNotification ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1.5 text-sm font-semibold text-rose-700">
              <span>{deletedGroupNotification}</span>
              <button
                type="button"
                onClick={onDismissDeletedNotification}
                disabled={!onDismissDeletedNotification}
                className="text-rose-700/80 transition hover:text-rose-900"
                aria-label="Dismiss delete notification"
              >
                ×
              </button>
            </div>
          ) : null}
        </div>

        {showHome ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            aria-label="Home"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </Button>
        ) : null}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: Notifications, Profile, Log out */}
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-100 bg-ink-50"
              title="Offline"
              aria-label="Offline"
            >
              <span className="sr-only">Offline</span>
              <WifiOff className="h-4 w-4 text-danger" aria-hidden />
            </span>
          ) : null}
          <NotificationCenter />
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

      {actionMessage ? (
        <div
          className={`mx-auto flex max-w-3xl items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:px-6 ${
            actionMessage.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role="status"
        >
          <span>{actionMessage.text}</span>
          <button
            type="button"
            className="font-semibold uppercase tracking-wide opacity-80 transition hover:opacity-100"
            onClick={onDismissAction}
            disabled={!onDismissAction}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </header>
  );
}