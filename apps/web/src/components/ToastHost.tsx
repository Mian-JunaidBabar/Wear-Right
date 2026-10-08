"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { dismissToast, getToasts, subscribeToasts, type ToastKind } from "@/lib/notify";

const STYLES: Record<ToastKind, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-slate-900 text-white",
};
const ICONS = { success: CheckCircle2, error: XCircle, info: Info } as const;
const EMPTY: never[] = [];

/** Draws the toasts raised by `notify()`. Mounted once, in Providers. */
export default function ToastHost() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, () => EMPTY);
  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 px-4 w-full max-w-md pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            role="status"
            data-testid="toast"
            data-kind={toast.kind}
            className={`pointer-events-auto w-full flex items-start gap-3 rounded-2xl px-4 py-3 shadow-xl text-sm font-semibold animate-[toast-in_180ms_ease-out] ${STYLES[toast.kind]}`}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="flex-1">{toast.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismissToast(toast.id)} className="opacity-80 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
