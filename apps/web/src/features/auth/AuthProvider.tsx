"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onSessionExpired } from "@/lib/api";
import type { UserState } from "@/lib/types";
import { authApi, type ProfilePatch, type Session } from "./api";

export const SESSION_HINT_COOKIE = "wr-session";

const GUEST: UserState = {
  id: null,
  name: "Guest User",
  email: "",
  avatar: "",
  role: "Guest",
  isLoggedIn: false,
  isStaff: false,
};

type AuthApi = {
  user: UserState;
  /** The raw profile, when signed in (sizes, gender, style). */
  profile: Session["profile"] | null;
  /** True until we know whether there is a session. */
  loading: boolean;
  login: (identifier: string, password: string) => Promise<Session>;
  register: (input: { name: string; email: string; password: string; password_confirm?: string }) => Promise<Session>;
  logout: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<Session>;
  /** Remember a scan result for this visit; signed-in users also get it saved to their profile. */
  setSkinTone: (tone: string) => void;
};

const AuthContext = createContext<AuthApi | null>(null);

function hasSessionHint(): boolean {
  try {
    return document.cookie.split("; ").some((part) => part === `${SESSION_HINT_COOKIE}=1`);
  } catch {
    return false;
  }
}

function clearSessionHint() {
  try {
    document.cookie = `${SESSION_HINT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    // ignore
  }
}

function toUserState(session: Session, scanTone: string | null): UserState {
  const { user, profile } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: "",
    role: user.is_staff ? "Admin" : "Customer",
    isLoggedIn: true,
    isStaff: user.is_staff,
    contrastType: scanTone ?? profile.skin_tone ?? undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanTone, setScanTone] = useState<string | null>(null);

  // Load the current user once on app start. Guests (no session hint) cost no request.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!hasSessionHint()) {
        setLoading(false);
        return;
      }
      try {
        const current = await authApi.me();
        if (!cancelled) setSession(current);
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 that refreshing could not fix means the session is gone.
  useEffect(
    () =>
      onSessionExpired(() => {
        clearSessionHint();
        setSession(null);
      }),
    [],
  );

  const login = useCallback(async (identifier: string, password: string) => {
    const next = await authApi.login(identifier, password);
    setSession(next);
    return next;
  }, []);

  const register = useCallback(async (input: { name: string; email: string; password: string; password_confirm?: string }) => {
    const next = await authApi.register(input);
    setSession(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The cookies may already be gone; the local state is cleared either way.
    }
    clearSessionHint();
    setSession(null);
    setScanTone(null);
  }, []);

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    const next = await authApi.updateMe(patch);
    setSession(next);
    return next;
  }, []);

  const setSkinTone = useCallback(
    (tone: string) => {
      setScanTone(tone);
      if (session && ["Fair", "Medium", "Dark"].includes(tone)) {
        // Best effort: the scan result is already usable even if saving fails.
        authApi.updateMe({ skin_tone: tone }).then(setSession, () => undefined);
      }
    },
    [session],
  );

  const user = useMemo(
    () => (session ? toUserState(session, scanTone) : { ...GUEST, contrastType: scanTone ?? undefined }),
    [session, scanTone],
  );

  const value = useMemo<AuthApi>(
    () => ({ user, profile: session?.profile ?? null, loading, login, register, logout, updateProfile, setSkinTone }),
    [user, session, loading, login, register, logout, updateProfile, setSkinTone],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
