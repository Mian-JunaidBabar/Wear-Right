"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { adminApi, type ToneRule } from "@/features/admin/api";
import { notify } from "@/lib/notify";

const DEPTHS: ToneRule["depth"][] = ["Fair", "Medium", "Dark"];
const UNDERTONES: ToneRule["undertone"][] = ["warm", "cool", "neutral"];
const SCORES: Array<{ value: ToneRule["score"]; label: string; className: string }> = [
  { value: 2, label: "Best", className: "bg-emerald-50 text-emerald-700" },
  { value: 1, label: "Good", className: "bg-sky-50 text-sky-700" },
  { value: -2, label: "Avoid", className: "bg-red-50 text-red-700" },
];
const FIELD = "border border-brand-border/60 rounded-xl px-3 py-2 text-sm font-semibold bg-white outline-none focus:border-sage-green";

/** The colour rules the recommender uses for each skin depth + undertone (recommender.ToneColorRule). */
export default function ToneRulesPanel({ canManage }: { canManage: boolean }) {
  const [rules, setRules] = useState<ToneRule[]>([]);
  const [depth, setDepth] = useState<ToneRule["depth"]>("Medium");
  const [undertone, setUndertone] = useState<ToneRule["undertone"]>("warm");
  const [colour, setColour] = useState("");
  const [score, setScore] = useState<ToneRule["score"]>(2);

  const load = useCallback(async () => {
    try {
      setRules((await adminApi.toneRules()).rules);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load the colour rules.", "error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: state is set after the request resolves
    void load();
  }, [load]);

  const shown = useMemo(() => rules.filter((rule) => rule.depth === depth && rule.undertone === undertone), [rules, depth, undertone]);
  const knownColours = useMemo(() => Array.from(new Set(rules.map((rule) => rule.color_name))).sort(), [rules]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!colour.trim()) return notify("Pick a colour name.", "error");
    try {
      await adminApi.createToneRule({ depth, undertone, color_name: colour.trim(), score });
      setColour("");
      notify("Colour rule added.", "success");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not add the rule.", "error");
    }
  }

  async function change(rule: ToneRule, next: ToneRule["score"]) {
    try {
      await adminApi.updateToneRule(rule.id, { score: next });
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update the rule.", "error");
    }
  }

  async function remove(rule: ToneRule) {
    try {
      await adminApi.deleteToneRule(rule.id);
      notify("Colour rule deleted.", "success");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not delete the rule.", "error");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div>
          <h3 className="text-lg font-black text-brand-dark">Colour rules</h3>
          <p className="text-sm text-slate-500 font-semibold mt-1">
            Which colours the recommender favours or avoids for each skin depth and undertone.
          </p>
        </div>
        <div className="flex gap-2">
          <select aria-label="Skin depth" className={FIELD} value={depth} onChange={(e) => setDepth(e.target.value as ToneRule["depth"])}>
            {DEPTHS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select aria-label="Undertone" className={FIELD} value={undertone} onChange={(e) => setUndertone(e.target.value as ToneRule["undertone"])}>
            {UNDERTONES.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {canManage && (
        <form onSubmit={add} className="flex flex-wrap gap-2 mb-5">
          <input
            aria-label="Colour name"
            list="tone-rule-colours"
            className={`${FIELD} flex-1 min-w-40`}
            placeholder="Colour name, e.g. Navy Blue"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
          />
          <datalist id="tone-rule-colours">
            {knownColours.map((name) => <option key={name} value={name} />)}
          </datalist>
          <select aria-label="Score" className={FIELD} value={score} onChange={(e) => setScore(Number(e.target.value) as ToneRule["score"])}>
            {SCORES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button type="submit" className="bg-brand-gold text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-slate-400 font-semibold py-6 text-center">No rules for {depth} / {undertone} yet.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {shown.map((rule) => {
            const meta = SCORES.find((s) => s.value === rule.score) ?? SCORES[0];
            return (
              <li key={rule.id} className="flex items-center gap-2 bg-cream-base border border-slate-100 rounded-xl px-3 py-2">
                <span className="flex-1 text-sm font-bold text-brand-dark truncate">{rule.color_name}</span>
                {canManage ? (
                  <select
                    aria-label={`Score for ${rule.color_name}`}
                    value={rule.score}
                    onChange={(e) => change(rule, Number(e.target.value) as ToneRule["score"])}
                    className={`text-[11px] font-black uppercase rounded-lg px-2 py-1 border-0 ${meta.className}`}
                  >
                    {SCORES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                ) : (
                  <span className={`text-[11px] font-black uppercase rounded-lg px-2 py-1 ${meta.className}`}>{meta.label}</span>
                )}
                {canManage && (
                  <button type="button" onClick={() => remove(rule)} aria-label={`Delete ${rule.color_name}`} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
