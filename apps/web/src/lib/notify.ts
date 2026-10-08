/**
 * User-facing feedback as short toasts (bottom of the screen, gone after a few seconds) instead of
 * blocking browser alerts. Call `notify("Added to cart")` from anywhere; `ToastHost` draws them.
 */
export type ToastKind = "success" | "error" | "info";
export type Toast = { id: number; message: string; kind: ToastKind };

export const TOAST_MS = 3500;
export const MAX_TOASTS = 4;

const ERROR_WORDS = /unable|failed|could not|couldn't|error|required|please|not available|out of stock|must|incorrect|invalid|cannot|can't|empty|not selected|not found/i;
const SUCCESS_WORDS = /added|saved|placed|success|removed|logged out|updated|deleted|copied|sent/i;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function inferKind(message: string): ToastKind {
  if (ERROR_WORDS.test(message)) return "error";
  return SUCCESS_WORDS.test(message) ? "success" : "info";
}

export function dismissToast(id: number): void {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function notify(message: string, kind?: ToastKind): void {
  if (!message) return;
  const toast: Toast = { id: nextId++, message, kind: kind ?? inferKind(message) };
  toasts = [...toasts, toast].slice(-MAX_TOASTS);
  timers.set(toast.id, setTimeout(() => dismissToast(toast.id), TOAST_MS));
  emit();
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts(): Toast[] {
  return toasts;
}

/** For tests: forget every toast and timer. */
export function resetToasts(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  toasts = [];
  nextId = 1;
  emit();
}
