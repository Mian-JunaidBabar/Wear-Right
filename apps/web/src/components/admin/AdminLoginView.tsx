"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { useAdminAuth } from "@/features/admin/AdminAuthProvider";
import { useNavigate, useSearchParams } from "@/lib/navigation";
import { safeNextPath } from "@/lib/routes";

/** /admin/login : the team's own sign-in. Shoppers sign in at /login; the two sessions never mix. */
export default function AdminLoginView() {
  const { session, loading, login } = useAdminAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requested = safeNextPath(searchParams.get("next"), "/admin");
  const next = requested.startsWith("/admin") && !requested.startsWith("/admin/login") ? requested : "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate(next);
  }, [loading, session, navigate, next]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    try {
      setSubmitting(true);
      await login(email.trim(), password);
      navigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream-base flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-xl bg-white border border-brand-border/60 shadow-sm flex items-center justify-center overflow-hidden">
            <img src="/brand/wr-icon.png" alt="" className="w-11 h-11 object-contain" />
          </div>
          <div>
            <p className="text-lg font-black text-brand-dark leading-tight">Wear Right</p>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Admin Panel</p>
          </div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-7 space-y-5">
          <div>
            <h1 className="text-2xl font-black text-brand-dark flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-sage-green" /> Team sign in
            </h1>
            <p className="text-sm text-slate-500 font-semibold mt-1">For Wear Right staff. Customers sign in on the shop.</p>
          </div>

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">Email</span>
            <input
              type="text"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@wearright.com"
              className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
            />
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-900 disabled:opacity-60 text-white py-3.5 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {submitting ? "Signing in..." : "Sign in"}
          </button>

          <Link
            href="/admin/forgot-password"
            className="block text-center text-sm font-black text-brand-gold hover:underline"
          >
            Forgot password?
          </Link>
        </form>

        <Link href="/" className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-dark">
          <ArrowLeft className="w-4 h-4" /> Back to the shop
        </Link>
      </div>
    </div>
  );
}
