/**
 * A tiny localStorage-backed store for useSyncExternalStore.
 *
 * - Server and first client render use `fallback`, so hydration never mismatches.
 * - Every storage access is wrapped in try/catch (private mode, quota, blocked storage).
 *   If storage fails the value still lives in memory for the current visit.
 * - Other tabs stay in sync through the `storage` event.
 */
export type LocalStore<T> = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  set: (next: T) => void;
  /** Forget the in-memory copy so the next read goes back to storage (tests, cross-tab). */
  reload: () => void;
};

export function createLocalStore<T>(key: string, fallback: T): LocalStore<T> {
  const listeners = new Set<() => void>();
  let current: T = fallback;
  let loaded = false;

  function load(): T {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  function emit() {
    listeners.forEach((listener) => listener());
  }

  function onStorage(event: StorageEvent) {
    if (event.key === key || event.key === null) {
      loaded = false;
      emit();
    }
  }

  return {
    subscribe(listener) {
      if (listeners.size === 0 && typeof window !== "undefined") {
        window.addEventListener("storage", onStorage);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && typeof window !== "undefined") {
          window.removeEventListener("storage", onStorage);
        }
      };
    },
    getSnapshot() {
      if (typeof window === "undefined") return fallback;
      if (!loaded) {
        current = load();
        loaded = true;
      }
      return current;
    },
    getServerSnapshot: () => fallback,
    set(next) {
      current = next;
      loaded = true;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // keep the in-memory value; persisting is best effort
      }
      emit();
    },
    reload() {
      loaded = false;
      emit();
    },
  };
}
