"use client";

/**
 * Admin "Mannequin" page (TASKS.md E2): every render layer over its base photo, hide/show/delete,
 * and the "Add render" form with the Gemini instructions. Reads GET /api/admin/mannequin/layers/;
 * writes need products.manage (the API enforces the same keys).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";

import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useAdminAuth } from "@/features/admin/AdminAuthProvider";
import {
  adminApi,
  type MannequinGender,
  type MannequinLayerRow,
  type MannequinLayersResponse,
} from "@/features/admin/api";

const GENDERS: MannequinGender[] = ["men", "women"];
/** The engine's canvas (catalog/engine/alpha_layers.py CANVAS): every base and layer is 960 x 1280. */
const ASPECT = "3 / 4";

const FIELD =
  "w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500";
const LABEL = "text-xs font-black uppercase tracking-wider text-slate-400 block mb-2";

type PickerProduct = { id: number; name: string };

function rejectionReason(error: unknown): string {
  if (error instanceof ApiError) {
    // A refused render answers 422 {"status": "rejected", "reason": ...}; other errors carry a message.
    const details = error.details as Record<string, unknown> | null;
    const reason = details && typeof details.reason === "string" ? details.reason : "";
    return reason || error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function skinMark(ok: boolean, label: string) {
  return (
    <span className={ok ? "text-emerald-600" : "text-slate-400"} title={ok ? "Skin copy passed the checks" : "No skin copy"}>
      {label} {ok ? "✓" : "✗"}
    </span>
  );
}

export default function MannequinSection() {
  const { can } = useAdminAuth();
  const canManage = can("products.manage");

  const [tab, setTab] = useState<MannequinGender>("men");
  const [data, setData] = useState<MannequinLayersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<PickerProduct[]>([]);

  // "Add render" form
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [slot, setSlot] = useState("");
  const [render, setRender] = useState<File | null>(null);
  const [renderFair, setRenderFair] = useState<File | null>(null);
  const [renderDark, setRenderDark] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (gender: MannequinGender) => {
    setLoading(true);
    setError("");
    try {
      setData(await adminApi.mannequinLayers(gender));
    } catch {
      setError("Unable to load the mannequin layers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: state is set after the request resolves
    void load(tab);
  }, [load, tab]);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .products<{ products?: PickerProduct[] }>()
      .then((body) => !cancelled && setProducts(body.products || []))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const base = data?.bases[tab] || null;
  const layers = data?.layers || [];
  const slots = data?.slots || [];
  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = needle ? products.filter((product) => product.name.toLowerCase().includes(needle)) : products;
    return list.slice(0, 50);
  }, [products, search]);
  const chosen = products.find((product) => String(product.id) === productId) || null;

  async function toggleLayer(layer: MannequinLayerRow) {
    try {
      await adminApi.setMannequinLayerApproved(layer.id, !layer.approved);
      notify(`${layer.product_name} is now ${layer.approved ? "hidden" : "live"} in the dressing room.`, "success");
      await load(tab);
    } catch (err) {
      notify(rejectionReason(err), "error");
    }
  }

  async function deleteLayer(layer: MannequinLayerRow) {
    if (!window.confirm(`Delete the ${layer.product_name} layer? This cannot be undone.`)) return;
    try {
      await adminApi.deleteMannequinLayer(layer.id);
      notify(`${layer.product_name} layer deleted.`, "success");
      await load(tab);
    } catch (err) {
      notify(rejectionReason(err), "error");
    }
  }

  async function uploadRender(event: React.FormEvent) {
    event.preventDefault();
    if (!chosen || !slot || !render) return;
    const form = new FormData();
    form.append("product_id", String(chosen.id));
    form.append("slot", slot);
    form.append("render", render);
    if (renderFair) form.append("render_fair", renderFair);
    if (renderDark) form.append("render_dark", renderDark);
    setUploading(true);
    setUploadMessage(null);
    try {
      await adminApi.uploadMannequinRender(form);
      setUploadMessage({ ok: true, text: "Added" });
      notify("Render added.", "success");
      setRender(null);
      setRenderFair(null);
      setRenderDark(null);
      setProductId("");
      setSlot("");
      setSearch("");
      await load(tab);
    } catch (err) {
      setUploadMessage({ ok: false, text: rejectionReason(err) });
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-brand-dark">Mannequin</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            The dressing room layers: one render per product, cut and checked against the base photo.
          </p>
        </div>
        <div className="inline-flex bg-white border border-brand-border/60 rounded-xl p-1" role="tablist" aria-label="Gender">
          {GENDERS.map((gender) => (
            <button
              key={gender}
              type="button"
              role="tab"
              aria-selected={tab === gender}
              onClick={() => setTab(gender)}
              className={`px-4 py-2 rounded-lg text-sm font-black capitalize ${
                tab === gender ? "bg-slate-900 text-white" : "text-slate-500 hover:text-brand-dark"
              }`}
            >
              {gender}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm font-bold">{error}</p>}
      {loading && <p className="text-sm font-bold text-slate-400">Loading layers…</p>}

      {!loading && !base && (
        <p className="rounded-xl bg-cream-card px-4 py-3 text-sm font-bold text-slate-500">
          There is no {tab} base yet: import the render kit first.
        </p>
      )}

      {!loading && base && layers.length === 0 && (
        <p className="rounded-xl bg-cream-card px-4 py-3 text-sm font-bold text-slate-500">
          No {tab} layers yet. Add the first render below.
        </p>
      )}

      {base && layers.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {layers.map((layer) => (
            <article key={layer.id} className="rounded-2xl border border-brand-border/60 bg-white shadow-sm p-4 flex flex-col gap-3">
              <div className="relative mx-auto w-full max-w-[220px]" style={{ aspectRatio: ASPECT }}>
                {/* two stacked <img>: the layer cut-out over the base photo */}
                <img src={base.image} alt="" className="absolute inset-0 h-full w-full object-contain" />
                <img src={layer.layer} alt="" className="absolute inset-0 h-full w-full object-contain" />
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-brand-dark" title={layer.product_name}>
                    {layer.product_name}
                  </p>
                  <p className="text-xs font-bold text-slate-400">{layer.slot_label}</p>
                </div>
                <span
                  className={`shrink-0 inline-flex px-3 py-1 rounded-full text-xs font-black ${
                    layer.approved ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {layer.approved ? "Live" : "Hidden"}
                </span>
              </div>
              {layer.note && <p className="text-xs font-semibold text-red-600 leading-snug">{layer.note}</p>}
              <div className="flex gap-3 text-[11px] font-black">
                {skinMark(layer.skins.fair === "ok", "Fair")}
                {skinMark(layer.skins.dark === "ok", "Dark")}
              </div>
              {canManage && (
                <div className="flex gap-2 mt-auto pt-1">
                  <button
                    type="button"
                    onClick={() => void toggleLayer(layer)}
                    className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-200"
                  >
                    {layer.approved ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteLayer(layer)}
                    className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-brand-border/60 bg-white shadow-sm p-6 space-y-5">
        <h3 className="text-lg font-black text-brand-dark">Add render</h3>

        <ol className="rounded-xl bg-cream-base border border-brand-border/60 px-5 py-4 space-y-2 text-sm font-semibold text-slate-600 list-decimal list-inside">
          <li>
            Open the base photo for this gender (
            {base ? (
              <a href={base.image} download className="text-brand-gold underline font-bold">
                Download base
              </a>
            ) : (
              "no base yet"
            )}
            ) in Gemini.
          </li>
          <li>Upload the base photo and the product photo. Use the prompt from the guide for this slot.</li>
          <li>Only the product may change. Same pose, same crop, same background, same size (960 x 1280 or 3:4).</li>
          <li>Optional: make the same render with fair and dark skin (Prompts K and L in the guide).</li>
          <li>
            Upload here. If it says &quot;does not line up&quot;, generate again; do not crop or resize the image yourself.
          </li>
        </ol>

        <form className="space-y-4" onSubmit={uploadRender}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="mannequin-product-search">
                Search products
              </label>
              <input
                id="mannequin-product-search"
                className={FIELD}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Type a product name…"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="mannequin-product">
                Product
              </label>
              <select
                id="mannequin-product"
                className={FIELD}
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required
              >
                <option value="">Choose a product…</option>
                {matches.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={LABEL} htmlFor="mannequin-slot">
                Slot
              </label>
              <select id="mannequin-slot" className={FIELD} value={slot} onChange={(event) => setSlot(event.target.value)} required>
                <option value="">Choose a slot…</option>
                {slots.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="mannequin-render">
                Main render (required)
              </label>
              <input
                id="mannequin-render"
                type="file"
                accept="image/*"
                className={FIELD}
                onChange={(event) => setRender(event.target.files?.[0] || null)}
              />
            </div>
            <div className="grid gap-4">
              <div>
                <label className={LABEL} htmlFor="mannequin-render-fair">
                  Fair skin render (optional)
                </label>
                <input
                  id="mannequin-render-fair"
                  type="file"
                  accept="image/*"
                  className={FIELD}
                  onChange={(event) => setRenderFair(event.target.files?.[0] || null)}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="mannequin-render-dark">
                  Dark skin render (optional)
                </label>
                <input
                  id="mannequin-render-dark"
                  type="file"
                  accept="image/*"
                  className={FIELD}
                  onChange={(event) => setRenderDark(event.target.files?.[0] || null)}
                />
              </div>
            </div>
          </div>

          {uploadMessage && (
            <p
              className={`rounded-xl px-4 py-3 text-sm font-bold ${
                uploadMessage.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
              role="status"
            >
              {uploadMessage.text}
            </p>
          )}

          <button
            type="submit"
            disabled={!chosen || !slot || !render || uploading}
            className="inline-flex items-center gap-2 bg-brand-gold hover:opacity-90 disabled:opacity-40 text-white px-5 py-3 rounded-xl text-sm font-bold"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Checking the render…" : "Add render"}
          </button>
        </form>
      </div>
    </section>
  );
}
