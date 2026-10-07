/** User-facing feedback. The shop uses plain browser alerts; keep them behind one function. */
export function notify(message: string): void {
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(message);
  }
}
