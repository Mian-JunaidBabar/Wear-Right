"use client";

import { useState } from "react";
import { KeyRound, LogOut, Save } from "lucide-react";
import { useAdminAuth } from "@/features/admin/AdminAuthProvider";
import { adminAuthApi } from "@/features/admin/api";
import { notify } from "@/lib/notify";

const FIELD =
  "w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green";
const LABEL = "text-xs font-black uppercase tracking-wider text-slate-400 block mb-2";

/** The signed-in admin's own account: name, password, sign out. */
export default function SettingsSection({ onLogout }: { onLogout: () => void }) {
  const { session, reload } = useAdminAuth();
  const [name, setName] = useState(session?.user.name ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return notify("Enter your name.", "error");
    try {
      await adminAuthApi.updateMe(name.trim());
      await reload();
      notify("Name saved.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save your name.", "error");
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!current || !next) return notify("Fill in both password fields.", "error");
    if (next !== confirm) return notify("The new passwords do not match.", "error");
    try {
      await adminAuthApi.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      notify("Password changed.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not change the password.", "error");
    }
  }

  return (
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <form onSubmit={saveName} className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-black text-brand-dark">Your profile</h3>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-sage-green/10 text-sage-green flex items-center justify-center text-2xl font-black">
            {(session?.user.name || "A").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-black text-brand-dark">{session?.user.email}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{session?.role.name}</p>
          </div>
        </div>
        <label className="block">
          <span className={LABEL}>Full name</span>
          <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className="bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2">
          <Save className="w-4 h-4" /> Save name
        </button>
        <div>
          <p className={LABEL}>What your role allows</p>
          <div className="flex flex-wrap gap-2">
            {(session?.permissions ?? []).map((permission) => (
              <span key={permission} className="px-3 py-1 rounded-lg bg-sage-green/10 text-sage-green text-[11px] font-black">
                {permission}
              </span>
            ))}
          </div>
        </div>
      </form>

      <div className="space-y-6">
        <form onSubmit={changePassword} className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-black text-brand-dark">Change password</h3>
          <label className="block">
            <span className={LABEL}>Current password</span>
            <input type="password" autoComplete="current-password" className={FIELD} value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="block">
            <span className={LABEL}>New password</span>
            <input type="password" autoComplete="new-password" className={FIELD} value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          <label className="block">
            <span className={LABEL}>Confirm new password</span>
            <input type="password" autoComplete="new-password" className={FIELD} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          <button type="submit" className="bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Change password
          </button>
        </form>

        <div className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-red-600">Sign out of the admin panel</h3>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Ends your admin session on this device. Your shop account, if any, is not affected.</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </section>
  );
}
