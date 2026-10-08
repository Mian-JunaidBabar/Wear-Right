"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { catalogApi, type ApiCategory, type ApiStyle } from "@/features/catalog/api";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notify";

const GENDERS: ApiCategory["gender"][] = ["men", "women", "unisex"];
const FIELD = "border border-brand-border/60 rounded-xl px-3 py-2 text-sm font-semibold bg-white outline-none focus:border-sage-green";

function reason(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Please try again.";
}

/** Staff screen for the shop's categories and styles. Changes show up in the shop, signup and profile at once. */
export default function AdminTaxonomy() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [styles, setStyles] = useState<ApiStyle[]>([]);
  const [newCategory, setNewCategory] = useState({ name: "", gender: "unisex" as ApiCategory["gender"], group: "" });
  const [newStyle, setNewStyle] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([catalogApi.categories(true), catalogApi.getStyles(true)]);
      setCategories(c.categories);
      setStyles(s.styles);
    } catch (error) {
      notify(`Could not load categories and styles. ${reason(error)}`, "error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: state is set after the request resolves
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      notify(done, "success");
      await load();
    } catch (error) {
      notify(`${done.replace(/ (added|saved|deleted|hidden|shown)\.?$/i, "")} failed. ${reason(error)}`, "error");
    }
  };

  const addCategory = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCategory.name.trim()) return notify("Enter a category name.", "error");
    void run(() => catalogApi.createCategory({ ...newCategory, name: newCategory.name.trim() }), "Category added.").then(() =>
      setNewCategory({ name: "", gender: "unisex", group: "" }),
    );
  };

  const addStyle = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newStyle.trim();
    if (!name) return notify("Enter a style name.", "error");
    void run(
      () => catalogApi.createStyle({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }),
      "Style added.",
    ).then(() => setNewStyle(""));
  };

  return (
    <section data-testid="admin-taxonomy" className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
      <div className="bg-white border border-brand-border/60 rounded-3xl p-6">
        <h2 className="text-lg font-black text-brand-dark">Categories</h2>
        <p className="text-sm text-slate-500 font-semibold mt-1 mb-4">
          Shown in the shop under the Men and Women tabs (unisex ones under both). A category appears once it has an active product in stock.
        </p>
        <form onSubmit={addCategory} className="flex flex-wrap gap-2 mb-5">
          <input aria-label="New category name" className={`${FIELD} flex-1 min-w-40`} placeholder="New category, e.g. Women Lehenga" value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} />
          <select aria-label="Shop tab" className={FIELD} value={newCategory.gender} onChange={(e) => setNewCategory({ ...newCategory, gender: e.target.value as ApiCategory["gender"] })}>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <input aria-label="Group" className={`${FIELD} w-32`} placeholder="Group (Regional)" value={newCategory.group} onChange={(e) => setNewCategory({ ...newCategory, group: e.target.value })} />
          <button type="submit" className="bg-brand-gold text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5"><Plus className="w-4 h-4" />Add</button>
        </form>
        <ul className="divide-y divide-slate-100">
          {categories.map((category) => (
            <li key={category.id} data-testid="category-row" className="py-2.5 flex items-center gap-3">
              <span className={`flex-1 text-sm font-bold ${category.is_active ? "text-brand-dark" : "text-slate-400 line-through"}`}>
                {category.name}
                {category.group && <span className="ml-2 text-[10px] uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{category.group}</span>}
              </span>
              <span className="text-xs text-slate-500 font-semibold w-16">{category.gender}</span>
              <span className="text-xs text-slate-500 font-semibold w-20">{category.product_count} in stock</span>
              <button type="button" title={category.is_active ? "Hide from the shop" : "Show in the shop"} onClick={() => run(() => catalogApi.updateCategory(category.id, { is_active: !category.is_active }), category.is_active ? "Category hidden." : "Category shown.")} className="text-slate-500 hover:text-slate-900">
                {category.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button type="button" title="Delete" onClick={() => window.confirm(`Delete "${category.name}"? Products keep their category text.`) && run(() => catalogApi.deleteCategory(category.id), "Category deleted.")} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white border border-brand-border/60 rounded-3xl p-6 self-start">
        <h2 className="text-lg font-black text-brand-dark">Styles</h2>
        <p className="text-sm text-slate-500 font-semibold mt-1 mb-4">Used on products, in the shop filter, and in each shopper&apos;s style preferences.</p>
        <form onSubmit={addStyle} className="flex gap-2 mb-5">
          <input aria-label="New style name" className={`${FIELD} flex-1`} placeholder="New style, e.g. Bridal" value={newStyle} onChange={(e) => setNewStyle(e.target.value)} />
          <button type="submit" className="bg-brand-gold text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5"><Plus className="w-4 h-4" />Add</button>
        </form>
        <ul className="divide-y divide-slate-100">
          {styles.map((style) => (
            <li key={style.id} data-testid="style-row" className="py-2.5 flex items-center gap-3">
              <span className={`flex-1 text-sm font-bold ${style.is_active ? "text-brand-dark" : "text-slate-400 line-through"}`}>{style.name}</span>
              <button type="button" title={style.is_active ? "Hide" : "Show"} onClick={() => run(() => catalogApi.updateStyle(style.id, { is_active: !style.is_active }), style.is_active ? "Style hidden." : "Style shown.")} className="text-slate-500 hover:text-slate-900">
                {style.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button type="button" title="Delete" onClick={() => window.confirm(`Delete "${style.name}"?`) && run(() => catalogApi.deleteStyle(style.id), "Style deleted.")} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
