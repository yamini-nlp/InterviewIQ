"use client";

import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "warning" | "error" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  exiting: boolean;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

const variantIcon: Record<ToastVariant, LucideIcon> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const variantClasses: Record<ToastVariant, string> = {
  default: "border-neutral-200 bg-neutral-50 text-neutral-900",
  success: "border-success-500/30 bg-success-500/10 text-success-600",
  warning: "border-warning-500/30 bg-warning-500/10 text-warning-600",
  error: "border-error-500/30 bg-error-500/10 text-error-600",
  info: "border-info-500/30 bg-info-500/10 text-info-600",
};

const variantIconClasses: Record<ToastVariant, string> = {
  default: "text-neutral-500",
  success: "text-success-500",
  warning: "text-warning-500",
  error: "text-error-500",
  info: "text-info-500",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const duration = options.duration ?? DEFAULT_DURATION;
      const variant = options.variant ?? "default";
      setToasts((prev) => [
        ...prev,
        { id, title: options.title, description: options.description, variant, duration, exiting: false },
      ]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastContext must be used within a ToastProvider");
  return ctx;
}

export function Toaster() {
  const { toasts, dismiss } = useToastContext();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = variantIcon[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm",
              variantClasses[t.variant],
              t.exiting ? "animate-toast-out" : "animate-fade-in"
            )}
          >
            <Icon size={18} className={cn("mt-0.5 flex-shrink-0", variantIconClasses[t.variant])} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-neutral-600">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="flex-shrink-0 rounded-md p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}