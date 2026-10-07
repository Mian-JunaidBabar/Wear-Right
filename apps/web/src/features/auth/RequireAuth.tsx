"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useNavigate } from "@/lib/navigation";
import { useAuth } from "./AuthProvider";

type Props = { children: ReactNode; staffOnly?: boolean };

/**
 * Client-side guard for private pages. proxy.ts already redirects visitors with no
 * cookies; this also catches expired sessions and enforces staff-only pages.
 */
export default function RequireAuth({ children, staffOnly = false }: Props) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const navigate = useNavigate();

  const mustSignIn = !loading && !user.isLoggedIn;
  useEffect(() => {
    if (mustSignIn) {
      const search = typeof window === "undefined" ? "" : window.location.search;
      navigate(`/login?next=${encodeURIComponent(pathname + search)}`);
    }
  }, [mustSignIn, navigate, pathname]);

  if (loading || mustSignIn) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center text-slate-500 font-semibold" role="status">
        Checking your session...
      </div>
    );
  }

  if (staffOnly && !user.isStaff) {
    return (
      <div className="w-full min-h-[50vh] flex flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
        <h1 className="text-3xl font-black text-brand-dark">Not authorised</h1>
        <p className="text-slate-500 font-semibold">This area is for Wear Right staff only.</p>
        <Link href="/" className="bg-slate-900 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider">
          Back to home
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
