"use client";

import { useEffect, type ReactNode } from "react";
import { AdminAuthProvider, useAdminAuth } from "@/features/admin/AdminAuthProvider";
import AdminView from "@/components/AdminView";
import { usePathname, useNavigate } from "@/lib/navigation";
import { ADMIN_LOGIN_PATH } from "@/lib/routes";

function Gate({ children }: { children: ReactNode }) {
  const { session, loading } = useAdminAuth();
  const pathname = usePathname();
  const navigate = useNavigate();
  const onLogin = pathname === ADMIN_LOGIN_PATH;
  const mustSignIn = !onLogin && !loading && !session;

  useEffect(() => {
    if (mustSignIn) {
      const search = typeof window === "undefined" ? "" : window.location.search;
      navigate(`${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}`);
    }
  }, [mustSignIn, navigate, pathname]);

  if (onLogin) return <>{children}</>;
  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 font-semibold bg-cream-base" role="status">
        Checking your admin session...
      </div>
    );
  }
  // The panel lives here (not in each page) so its data and sidebar survive moving between sections.
  return <AdminView />;
}

/** Everything under /admin: its own session provider, then either the login page or the panel. */
export default function AdminRoot({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <Gate>{children}</Gate>
    </AdminAuthProvider>
  );
}
