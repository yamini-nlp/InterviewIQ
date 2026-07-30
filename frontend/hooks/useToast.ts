"use client";

import { ToastOptions, useToastContext } from "@/components/ui/Toast";

export function useToast() {
  const { toast, dismiss, toasts } = useToastContext();

  return {
    toast: (options: ToastOptions) => toast(options),
    dismiss,
    toasts,
  };
}