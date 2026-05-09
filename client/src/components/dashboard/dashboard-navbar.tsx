import { NotificationCenter } from "@/components/dashboard/notification-center";

interface DashboardNavbarProps {
    actionMessage?: {
        kind: "success" | "error";
        text: string;
    } | null;
    onDismissAction: () => void;
    deletedGroupNotification?: string | null;
    onDismissDeletedNotification: () => void;
}

export function DashboardNavbar({
    actionMessage,
    onDismissAction,
    deletedGroupNotification,
    onDismissDeletedNotification,
}: DashboardNavbarProps) {
    return (
        <div className="relative z-50 border-b border-slate-200 bg-white">            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
                <p className="hidden text-sm text-slate-500 sm:block">Manage your group expenses.</p>
                {deletedGroupNotification ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700">
                        <span>{deletedGroupNotification}</span>
                        <button
                            type="button"
                            onClick={onDismissDeletedNotification}
                            className="text-rose-700/80 transition hover:text-rose-900"
                            aria-label="Dismiss delete notification"
                        >
                            ×
                        </button>
                    </div>
                ) : null}
            </div>

            <div className="relative">
                <NotificationCenter />
            </div>
        </div>

            {actionMessage ? (
                <div
                    className={`mx-auto flex max-w-3xl items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:px-6 ${actionMessage.kind === "success"
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
                    >
                        Dismiss
                    </button>
                </div>
            ) : null}
        </div>
    );
}
