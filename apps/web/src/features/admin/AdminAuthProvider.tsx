"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAdminSessionExpired } from "@/lib/api";
import { adminAuthApi, type AdminPermission, type AdminSession } from "./api";

/** Set by Django next to the admin cookies. Carries no secret; it only says "worth asking /me". */
export const ADMIN_SESSION_HINT = "wr-admin-session";

type AdminAuth = {
  session: AdminSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AdminSession>;
  logout: () => Promise<void>;
  /** Re-read the signed-in admin (after editing their own name, say). */
  reload: () => Promise<void>;
  can: (permission: AdminPermission) => boolean;
};

const AdminAuthContext = createContext<AdminAuth | null>(null);

function hasHint(): boolean {
  try {
    return document.cookie.split("; ").some((part) => part === `${ADMIN_SESSION_HINT}=1`);
  } catch {
    return false;
  }
}

function clearHint() {
  try {
    document.cookie = `${ADMIN_SESSION_HINT}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    // ignore
  }
}

/** The admin panel's session. Completely separate from the shop's AuthProvider. */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!hasHint()) {
        setLoading(false);
        return;
      }
      try {
        const current = await adminAuthApi.me();
        if (!cancelled) setSession(current);
      } catch {
        if (!cancelled) {
          clearHint();
          setSession(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      onAdminSessionExpired(() => {
        clearHint();
        setSession(null);
      }),
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const next = await adminAuthApi.login(email, password);
    setSession(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminAuthApi.logout();
    } catch {
      // cookies may already be gone; local state is cleared either way
    }
    clearHint();
    setSession(null);
  }, []);

  const reload = useCallback(async () => {
    setSession(await adminAuthApi.me());
  }, []);

  const can = useCallback((permission: AdminPermission) => Boolean(session?.permissions.includes(permission)), [session]);

  const value = useMemo<AdminAuth>(
    () => ({ session, loading, login, logout, reload, can }),
    [session, loading, login, logout, reload, can],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuth {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used inside <AdminAuthProvider>");
  return context;
}
