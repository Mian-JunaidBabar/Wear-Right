"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { adminAuthApi } from "@/features/admin/api";
import { useAdminAuth } from "@/features/admin/AdminAuthProvider";
import { useNavigate, useSearchParams } from "@/lib/navigation";
import { notify } from "@/lib/notify";
import { ADMIN_FORGOT_PASSWORD_PATH, ADMIN_LOGIN_PATH } from "@/lib/routes";

/** /admin/reset-password?uid=&token= : set a new password from the emailed link. */
export default function AdminResetPasswordView() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const { logout } = useAdminAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const completeLink = Boolean(uid && token);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    try {
      setSubmitting(true);
      await adminAuthApi.confirmPasswordReset({
        uid,
        token,
        new_password1: password,
        new_password2: confirmPassword,
      });
      await logout();
      notify("Password reset. Sign in with your new password.", "success");
      navigate(ADMIN_LOGIN_PATH);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password. Request a new link.");
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
              <KeyRound className="w-6 h-6 text-sage-green" /> Set a new password
            </h1>
            <p className="text-sm text-slate-500 font-semibold mt-1">Choose the password you will use to sign in.</p>
          </div>

          {!completeLink ? (
            <div className="space-y-4">
              <p role="alert" className="text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                This reset link is incomplete or has expired.
              </p>
              <Link href={ADMIN_FORGOT_PASSWORD_PATH} className="font-black text-sm text-brand-gold hover:underline">
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              {error && (
                <p role="alert" className="text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">New password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">Confirm password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 disabled:opacity-60 text-white py-3.5 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                {submitting ? "Saving..." : "Save password"}
              </button>
            </form>
          )}
        </div>

        <Link
          href={ADMIN_LOGIN_PATH}
          className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-dark"
        >
          Back to team sign in
        </Link>
      </div>
    </div>
  );
}
