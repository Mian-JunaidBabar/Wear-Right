"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Shirt, Shuffle } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { useNavigate, useSearchParams } from "@/lib/navigation";
import { mannequinApi, type AlphaSlot, type AlphaWardrobe } from "@/features/mannequin/api";
import {
  allImageUrls,
  defaultOutfit,
  layerStack,
  outfitTotal,
  shuffleOutfit,
  toggleItem,
  wornItems,
  type Outfit,
} from "@/features/mannequin/dressingRoom";

type LoadState = { status: "loading" } | { status: "ready"; wardrobe: AlphaWardrobe } | { status: "error" };

function formatPKR(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;
}

/**
 * Mannequin (alpha): one AI-generated model photo and a garment layer per product, stacked in the browser,
 * so the shopper can try any shirt with any trousers, shoes and watch and see the whole outfit at once.
 * Only the curated alpha products have layers (see docs/plans/11-mannequin-alpha-pilot.md).
 */
export default function DressingRoomView() {
  const [params] = useSearchParams();
  const focus = Number(params.get("product")) || null;
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    mannequinApi
      .wardrobe("men")
      .then((wardrobe) => {
        if (!cancelled) setState({ status: "ready", wardrobe });
      })
      .catch((error) => {
        console.error("Mannequin wardrobe error:", error);
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" aria-label="Loading the mannequin" />
      </main>
    );
  }

  if (state.status === "error" || !state.wardrobe.base || state.wardrobe.slots.length === 0) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
        <Shirt className="w-10 h-10 text-slate-300" />
        <h1 className="text-xl font-black text-brand-dark">Mannequin preview is coming soon</h1>
        <p className="max-w-md text-sm font-semibold text-slate-500">
          {state.status === "error"
            ? "We could not load the mannequin right now. Please try again in a moment."
            : "No products are on the mannequin yet."}
        </p>
      </main>
    );
  }

  return <DressingRoom key={focus ?? "none"} wardrobe={state.wardrobe} focus={focus} />;
}

function DressingRoom({ wardrobe, focus }: { wardrobe: AlphaWardrobe; focus: number | null }) {
  const navigate = useNavigate();
  const [outfit, setOutfit] = useState<Outfit>(() => defaultOutfit(wardrobe, focus));
  const base = wardrobe.base!;

  // Load every layer once, up front, so picking a different shirt swaps instantly.
  useEffect(() => {
    for (const url of allImageUrls(wardrobe)) {
      const image = new Image();
      image.src = url;
    }
  }, [wardrobe]);

  const layers = useMemo(() => layerStack(wardrobe, outfit), [wardrobe, outfit]);
  const worn = useMemo(() => wornItems(wardrobe, outfit), [wardrobe, outfit]);
  const total = useMemo(() => outfitTotal(wardrobe, outfit), [wardrobe, outfit]);

  const pick = (slot: AlphaSlot, productId: number) => setOutfit((current) => toggleItem(current, slot, productId));

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
      <header className="mb-6 lg:mb-8">
        <p className="text-[10px] font-black uppercase tracking-widest text-brand-gold">Mannequin · alpha</p>
        <h1 className="mt-1 text-2xl lg:text-3xl font-black text-brand-dark">Try outfits on the mannequin</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">
          Pick a shirt, trousers, shoes and a watch and see them together. Pick an item again to take it off.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-6 lg:gap-10 items-start">
        <section className="lg:sticky lg:top-28">
          <div
            data-testid="mannequin-stage"
            className="relative mx-auto w-full max-w-sm lg:max-w-none overflow-hidden rounded-3xl border border-brand-border/60 bg-slate-100 shadow-sm"
            style={{ aspectRatio: `${base.width} / ${base.height}` }}
          >
            <img src={base.image} alt={`${base.label} wearing the selected outfit`} className="absolute inset-0 h-full w-full object-contain" />
            {layers.map((layer) => (
              <img
                key={layer.key}
                src={layer.src}
                alt=""
                aria-hidden="true"
                data-testid="mannequin-layer"
                data-layer={layer.key}
                className="absolute inset-0 h-full w-full object-contain"
                style={{ zIndex: layer.z }}
              />
            ))}
            <span className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 shadow-sm">
              Alpha · {base.label}
            </span>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setOutfit(shuffleOutfit(wardrobe))}
              className="flex-1 rounded-xl bg-brand-dark py-3 text-xs font-black uppercase tracking-wider text-white flex items-center justify-center gap-2 hover:opacity-90"
            >
              <Shuffle className="w-4 h-4" /> Shuffle
            </button>
            <button
              type="button"
              onClick={() => setOutfit(defaultOutfit(wardrobe, focus))}
              className="flex-1 rounded-xl border border-brand-border bg-white py-3 text-xs font-black uppercase tracking-wider text-brand-dark flex items-center justify-center gap-2 hover:bg-slate-50"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        </section>

        <section className="min-w-0 space-y-6">
          {wardrobe.slots.map((row) => (
            <div key={row.slot}>
              <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">{row.label}</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {row.items.map((item) => {
                  const selected = outfit[row.slot] === item.product_id;
                  return (
                    <button
                      key={item.product_id}
                      type="button"
                      aria-pressed={selected}
                      data-testid="mannequin-option"
                      onClick={() => pick(row.slot, item.product_id)}
                      className={`w-32 shrink-0 rounded-2xl border bg-white p-2 text-left transition-all ${
                        selected ? "border-brand-gold ring-2 ring-brand-gold" : "border-brand-border/60 hover:border-brand-gold/60"
                      }`}
                    >
                      <ProductImage src={item.image} alt={item.name} className="h-28 w-full rounded-xl bg-slate-50" />
                      <p className="mt-2 line-clamp-2 text-xs font-bold text-brand-dark">{item.name}</p>
                      <p className="mt-1 text-xs font-black text-slate-500">{formatPKR(item.price)}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="rounded-3xl border border-brand-border/60 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black text-brand-dark">You are wearing</h2>
            {worn.length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-slate-500">Nothing yet. Pick something above.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {worn.map(({ slot, label, item }) => (
                  <li key={slot} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                      <p className="truncate text-sm font-bold text-brand-dark">{item.name}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-black text-brand-dark">{formatPKR(item.price)}</span>
                      {item.available && (
                        <button
                          type="button"
                          onClick={() => navigate(`/product/${item.product_id}`)}
                          className="rounded-lg bg-brand-gold px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:opacity-90"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Outfit total</p>
              <p data-testid="mannequin-total" className="text-lg font-black text-brand-dark">{formatPKR(total)}</p>
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-400">
            Alpha preview for selected products. The model photo and garment images are AI-generated from our product photos.
          </p>
        </section>
      </div>
    </main>
  );
}
