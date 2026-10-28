"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit2, Lock, Plus, Save, ShieldCheck, Trash2, UserPlus, Users, X } from "lucide-react";
import { adminApi, type AdminMember, type AdminPermission, type AdminRole, type PermissionInfo } from "@/features/admin/api";
import { notify } from "@/lib/notify";

const FIELD =
  "w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green";
const LABEL = "text-xs font-black uppercase tracking-wider text-slate-400 block mb-2";

type MemberForm = {
  id: number | null;
  name: string;
  email: string;
  password: string;
  role: number | "";
  is_active: boolean;
  email_invite: boolean;
};
type RoleForm = { id: number | null; name: string; description: string; permissions: AdminPermission[] };

const EMPTY_MEMBER: MemberForm = {
  id: null,
  name: "",
  email: "",
  password: "",
  role: "",
  is_active: true,
  email_invite: false,
};
const EMPTY_ROLE: RoleForm = { id: null, name: "", description: "", permissions: [] };

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function when(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

/** Team members and roles (RBAC): who can sign in to the admin panel and what each role may do. */
export default function TeamSection() {
  const [tab, setTab] = useState<"members" | "roles">("members");
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [catalog, setCatalog] = useState<PermissionInfo[]>([]);
  const [memberForm, setMemberForm] = useState<MemberForm | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, r] = await Promise.all([adminApi.members(), adminApi.roles()]);
      setMembers(m.members);
      setRoles(r.roles);
      setCatalog(r.permissions);
    } catch (error) {
      notify(message(error, "Could not load the team."), "error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: state is set after the request resolves
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, PermissionInfo[]>();
    catalog.forEach((item) => map.set(item.group, [...(map.get(item.group) ?? []), item]));
    return Array.from(map.entries());
  }, [catalog]);

  async function saveMember(event: React.FormEvent) {
    event.preventDefault();
    if (!memberForm) return;
    const { id, name, email, password, role, is_active, email_invite } = memberForm;
    if (!name.trim() || role === "" || (id === null && !email.trim()) || (id === null && !email_invite && !password)) {
      return notify(email_invite ? "Fill in the name, email and role." : "Fill in the name, email, password and role.", "error");
    }
    try {
      setSaving(true);
      if (id === null) {
        await adminApi.createMember({
          name: name.trim(),
          email: email.trim(),
          role,
          is_active,
          ...(email_invite ? { email_invite: true } : { password }),
        });
        notify(
          email_invite ? "Team member added. They will get an email to set their password." : "Team member added.",
          "success",
        );
      } else {
        await adminApi.updateMember(id, { name: name.trim(), role, is_active, ...(password ? { password } : {}) });
        notify("Team member saved.", "success");
      }
      setMemberForm(null);
      await load();
    } catch (error) {
      notify(message(error, "Could not save the team member."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(member: AdminMember) {
    if (!window.confirm(`Remove ${member.name} from the team? They will no longer be able to sign in.`)) return;
    try {
      await adminApi.deleteMember(member.id);
      notify("Team member removed.", "success");
      await load();
    } catch (error) {
      notify(message(error, "Could not remove the team member."), "error");
    }
  }

  async function saveRole(event: React.FormEvent) {
    event.preventDefault();
    if (!roleForm) return;
    if (!roleForm.name.trim()) return notify("Give the role a name.", "error");
    const body = { name: roleForm.name.trim(), description: roleForm.description, permissions: roleForm.permissions };
    try {
      setSaving(true);
      if (roleForm.id === null) await adminApi.createRole(body);
      else await adminApi.updateRole(roleForm.id, body);
      notify(roleForm.id === null ? "Role added." : "Role saved.", "success");
      setRoleForm(null);
      await load();
    } catch (error) {
      notify(message(error, "Could not save the role."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeRole(role: AdminRole) {
    if (!window.confirm(`Delete the ${role.name} role?`)) return;
    try {
      await adminApi.deleteRole(role.id!);
      notify("Role deleted.", "success");
      await load();
    } catch (error) {
      notify(message(error, "Could not delete the role."), "error");
    }
  }

  const togglePermission = (key: AdminPermission) =>
    setRoleForm((form) =>
      form && {
        ...form,
        permissions: form.permissions.includes(key) ? form.permissions.filter((p) => p !== key) : [...form.permissions, key],
      },
    );

  const active = members.filter((m) => m.is_active).length;

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Team members" value={members.length} />
        <Stat label="Active" value={active} />
        <Stat label="Inactive" value={members.length - active} />
        <Stat label="Roles" value={roles.length} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-white border border-brand-border/60 rounded-xl p-1" role="tablist">
          {(["members", "roles"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-black capitalize flex items-center gap-2 ${
                tab === key ? "bg-slate-900 text-white" : "text-slate-500 hover:text-brand-dark"
              }`}
            >
              {key === "members" ? <Users className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              {key}
            </button>
          ))}
        </div>
        {tab === "members" ? (
          <button
            type="button"
            onClick={() => setMemberForm({ ...EMPTY_MEMBER, role: roles.find((r) => !r.is_system)?.id ?? "" })}
            className="bg-brand-gold hover:opacity-90 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Add member
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setRoleForm(EMPTY_ROLE)}
            className="bg-brand-gold hover:opacity-90 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add role
          </button>
        )}
      </div>

      {tab === "members" && (
        <div className="bg-white rounded-2xl border border-brand-border/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-cream-base border-b border-slate-100">
                <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-black">
                  <th className="p-4 text-left">Member</th>
                  <th className="p-4 text-left">Email</th>
                  <th className="p-4 text-left">Role</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Last sign in</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => (
                  <tr key={member.id} data-testid="member-row">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-sage-green/10 text-sage-green flex items-center justify-center font-black">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-black text-brand-dark">
                          {member.name}
                          {member.is_self && <span className="ml-2 text-[10px] font-black uppercase text-slate-400">(you)</span>}
                        </p>
                      </div>
                    </td>
                    <td className="p-4 font-bold text-slate-600">{member.email}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full bg-cream-card text-brand-dark text-xs font-black">{member.role.name}</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          member.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {member.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-500">{when(member.last_login)}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          aria-label={`Edit ${member.name}`}
                          onClick={() =>
                            setMemberForm({
                              id: member.id,
                              name: member.name,
                              email: member.email,
                              password: "",
                              role: member.role.id ?? "",
                              is_active: member.is_active,
                              email_invite: false,
                            })
                          }
                          className="p-2 rounded-lg bg-cream-card/60 text-slate-600 hover:text-sage-green"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!member.is_self && (
                          <button
                            type="button"
                            aria-label={`Remove ${member.name}`}
                            onClick={() => removeMember(member)}
                            className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {members.length === 0 && <p className="p-10 text-center text-slate-400 font-bold">No team members yet.</p>}
          </div>
        </div>
      )}

      {tab === "roles" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {roles.map((role) => (
            <div key={role.id} data-testid="role-card" className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-brand-dark flex items-center gap-2">
                    {role.name}
                    {role.is_system && <Lock className="w-4 h-4 text-slate-400" aria-label="System role" />}
                  </h3>
                  <p className="text-sm text-slate-500 font-semibold mt-1">{role.description || "No description."}</p>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    {role.member_count} member{role.member_count === 1 ? "" : "s"}
                  </p>
                </div>
                {!role.is_system && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-label={`Edit ${role.name}`}
                      onClick={() =>
                        setRoleForm({ id: role.id, name: role.name, description: role.description, permissions: role.permissions })
                      }
                      className="p-2 rounded-lg bg-cream-card/60 text-slate-600 hover:text-sage-green"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${role.name}`}
                      onClick={() => removeRole(role)}
                      className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {role.permissions.map((key) => (
                  <span key={key} className="px-2.5 py-1 rounded-lg bg-sage-green/10 text-sage-green text-[11px] font-black">
                    {catalog.find((item) => item.key === key)?.label ?? key}
                  </span>
                ))}
                {role.permissions.length === 0 && <span className="text-xs text-slate-400 font-semibold">No permissions</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {memberForm && (
        <Modal title={memberForm.id === null ? "Add team member" : "Edit team member"} onClose={() => setMemberForm(null)}>
          <form onSubmit={saveMember} className="space-y-4">
            <label className="block">
              <span className={LABEL}>Full name</span>
              <input className={FIELD} value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} />
            </label>
            <label className="block">
              <span className={LABEL}>Email</span>
              <input
                type="email"
                className={`${FIELD} ${memberForm.id !== null ? "opacity-60" : ""}`}
                value={memberForm.email}
                readOnly={memberForm.id !== null}
                onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
              />
            </label>
            {memberForm.id === null && (
              <label className="flex items-start gap-3 bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={memberForm.email_invite}
                  onChange={(e) => setMemberForm({ ...memberForm, email_invite: e.target.checked })}
                />
                <span>
                  Email them a link to set their password
                  <span className="block text-xs font-semibold text-slate-400 mt-0.5">
                    The member chooses their own password from the email.
                  </span>
                </span>
              </label>
            )}
            {!memberForm.email_invite && (
              <label className="block">
                <span className={LABEL}>{memberForm.id === null ? "Password" : "New password (leave blank to keep)"}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={FIELD}
                  value={memberForm.password}
                  onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })}
                />
              </label>
            )}
            <label className="block">
              <span className={LABEL}>Role</span>
              <select
                className={FIELD}
                value={memberForm.role}
                onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value === "" ? "" : Number(e.target.value) })}
              >
                <option value="">Choose a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id ?? ""}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={memberForm.is_active} onChange={(e) => setMemberForm({ ...memberForm, is_active: e.target.checked })} />
              Active (can sign in)
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-brand-gold disabled:opacity-60 text-white py-3.5 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> {memberForm.id === null ? "Add member" : "Save member"}
            </button>
          </form>
        </Modal>
      )}

      {roleForm && (
        <Modal title={roleForm.id === null ? "Add role" : "Edit role"} onClose={() => setRoleForm(null)}>
          <form onSubmit={saveRole} className="space-y-4">
            <label className="block">
              <span className={LABEL}>Role name</span>
              <input className={FIELD} value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} />
            </label>
            <label className="block">
              <span className={LABEL}>Description</span>
              <input className={FIELD} value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} />
            </label>
            <fieldset>
              <legend className={LABEL}>Permissions</legend>
              <div className="space-y-3">
                {groups.map(([group, items]) => (
                  <div key={group} className="bg-cream-base border border-slate-100 rounded-xl p-3">
                    <p className="text-xs font-black text-brand-dark mb-2">{group}</p>
                    <div className="space-y-1.5">
                      {items.map((item) => (
                        <label key={item.key} className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                          <input type="checkbox" checked={roleForm.permissions.includes(item.key)} onChange={() => togglePermission(item.key)} />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-brand-gold disabled:opacity-60 text-white py-3.5 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> {roleForm.id === null ? "Add role" : "Save role"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-brand-border/60 shadow-sm">
      <p className="text-[11px] uppercase tracking-widest text-slate-400 font-black">{label}</p>
      <p className="text-3xl font-black text-brand-dark mt-2">{value}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-white rounded-2xl shadow-2xl border border-brand-border/60 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-black text-brand-dark">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-xl bg-cream-card/60 hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
