import { create } from "zustand";
import { createContext, useContext, type ReactNode } from "react";

interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

interface ToastStore {
    toasts: Toast[];
    addToast: (message: string, type?: Toast["type"]) => void;
    removeToast: (id: string) => void;
}

const useToastStore = create<ToastStore>((set, get) => ({
    toasts: [],
    addToast: (message, type = "info") => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const toast: Toast = { id, message, type };
        set((state) => ({ toasts: [...state.toasts, toast] }));
        // Auto-remove after 5 seconds
        setTimeout(() => {
            get().removeToast(id);
        }, 5000);
    },
    removeToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    },
}));

const ToastContext = createContext<ToastStore | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    return (
        <ToastContext.Provider value={useToastStore()}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

export function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-10000 space-y-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${toast.type === "success"
                        ? "bg-green-50 text-green-800 border border-green-200"
                        : toast.type === "error"
                            ? "bg-red-50 text-red-800 border border-red-200"
                            : "bg-blue-50 text-blue-800 border border-blue-200"
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <span>{toast.message}</span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="ml-4 text-current opacity-70 hover:opacity-100"
                        >
                            ×
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}