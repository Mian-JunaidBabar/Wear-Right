"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { authApi } from "@/features/auth/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { useNavigate, useSearchParams } from "@/lib/navigation";
import { notify } from "@/lib/notify";

const MIN_PASSWORD_LENGTH = 6;

/** /reset-password?uid=...&token=... : the page the email links to. */
export default function ResetPasswordView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { logout } = useAuth();
  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const linkIsComplete = Boolean(uid && token);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    try {
      setSubmitting(true);
      await authApi.confirmPasswordReset({
        uid,
        token,
        new_password1: password,
        new_password2: confirm,
      });
      // The server cleared the shop cookies. Clear the stale user held in memory too.
      await logout();
      notify("Password reset. Log in with your new password.", "success");
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password. Please request a new link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base flex items-center justify-center px-6 py-12 font-sans">
      <div className="w-full max-w-md bg-white border border-brand-border/60 rounded-2xl shadow-sm p-7">
        <div className="w-12 h-12 rounded-xl bg-cream-base border border-brand-border/60 flex items-center justify-center">
          <KeyRound className="w-6 h-6 text-brand-gold" />
        </div>
        <h1 className="mt-4 text-3xl font-black text-brand-dark tracking-tight">Choose a new password</h1>

        {!linkIsComplete ? (
          <>
            <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              This reset link is incomplete. Request a new one and use the latest email.
            </p>
            <Link href="/forgot-password" className="mt-5 inline-block text-sm font-black text-sage-green hover:underline">
              Request a new link
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            {error && (
              <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                className="w-full rounded-xl border border-brand-border/60 bg-cream-base px-4 py-3 text-sm font-semibold outline-none focus:border-sage-green focus:ring-2 focus:ring-sage-green/20"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Type the password again"
                className="w-full rounded-xl border border-brand-border/60 bg-cream-base px-4 py-3 text-sm font-semibold outline-none focus:border-sage-green focus:ring-2 focus:ring-sage-green/20"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand-gold py-3.5 text-sm font-black uppercase tracking-widest text-white disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Set new password"}
            </button>

            <Link href="/forgot-password" className="block text-center text-xs font-black text-slate-500 hover:text-brand-dark">
              This link is old or broken — request a new one
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
