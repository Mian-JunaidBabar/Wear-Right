"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { authApi } from "@/features/auth/api";

const SENT_MESSAGE = "If an account exists for this email, we sent a reset link. Check your inbox.";

/** /forgot-password : the answer never says whether the address has an account. */
export default function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Enter the email you use for Wear Right.");
      return;
    }
    try {
      setSubmitting(true);
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base flex items-center justify-center px-6 py-12 font-sans">
      <div className="w-full max-w-md bg-white border border-brand-border/60 rounded-2xl shadow-sm p-7">
        <Link href="/login" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-brand-dark">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>

        <div className="mt-6 w-12 h-12 rounded-xl bg-cream-base border border-brand-border/60 flex items-center justify-center">
          <Mail className="w-6 h-6 text-brand-gold" />
        </div>
        <h1 className="mt-4 text-3xl font-black text-brand-dark tracking-tight">Forgot your password?</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Enter your email and we will send you a link to choose a new password.
        </p>

        {sent ? (
          <div role="status" className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            {SENT_MESSAGE}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            {error && (
              <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">Email address</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="customer@gmail.com"
                className="w-full rounded-xl border border-brand-border/60 bg-cream-base px-4 py-3 text-sm font-semibold outline-none focus:border-sage-green focus:ring-2 focus:ring-sage-green/20"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand-gold py-3.5 text-sm font-black uppercase tracking-widest text-white disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-xs font-semibold text-slate-400">
          Local development: read the email at{" "}
          <a href="http://localhost:8025" target="_blank" rel="noreferrer" className="font-black text-sage-green hover:underline">
            localhost:8025
          </a>
          .
        </p>
      </div>
    </div>
  );
}
