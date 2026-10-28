"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { adminAuthApi } from "@/features/admin/api";
import { ADMIN_LOGIN_PATH } from "@/lib/routes";

const SENT_MESSAGE = "If an account exists for this email, we sent a reset link. Check your inbox.";

/** /admin/forgot-password : the team's reset request. The answer never says whether the address exists. */
export default function AdminForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Enter your work email.");
      return;
    }
    try {
      setSubmitting(true);
      await adminAuthApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset link.");
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

        <div className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-7 space-y-5">
          <div>
            <h1 className="text-2xl font-black text-brand-dark flex items-center gap-2">
              <Mail className="w-6 h-6 text-sage-green" /> Forgot password
            </h1>
            <p className="text-sm text-slate-500 font-semibold mt-1">We will email a reset link to your team address.</p>
          </div>

          {sent ? (
            <p role="status" className="text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
              {SENT_MESSAGE}
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              {error && (
                <p role="alert" className="text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@wearright.com"
                  className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 disabled:opacity-60 text-white py-3.5 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {submitting ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}

          <p className="text-xs font-semibold text-slate-400">
            Local emails:{" "}
            <a href="http://localhost:8025" target="_blank" rel="noreferrer" className="font-black text-brand-gold hover:underline">
              http://localhost:8025
            </a>
          </p>
        </div>

        <Link
          href={ADMIN_LOGIN_PATH}
          className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-dark"
        >
          <ArrowLeft className="w-4 h-4" /> Back to team sign in
        </Link>
      </div>
    </div>
  );
}
