"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "@/lib/navigation";
import { ArrowLeft, ShoppingCart, Sparkles } from "lucide-react";
import { CartProduct } from "@/features/cart/types";
import { useAuth } from "@/features/auth/AuthProvider";
import { useCart } from "@/features/cart/useCart";
import { recommenderApi, type ApiItem, type CompleteLookResponse, type LookEntry } from "@/features/recommender/api";
import { normalizeSkinTone } from "@/features/recommender/recommendationRules";
import { buildOutfitBoardTiles } from "@/features/outfit/board";
import OutfitBoard from "@/components/OutfitBoard";
import ProductImage from "@/components/ProductImage";
import { PLACEHOLDER_IMAGE } from "@/lib/config";
import { notify } from "@/lib/notify";

const LOOK_TITLES: Record<CompleteLookResponse["look_type"], string> = {
  casual: "Casual look",
  formal: "Formal look",
  eastern_men: "Eastern look",
  eastern_women: "Eastern look",
};

const SLOT_TITLES: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  footwear: "Shoes",
  outerwear: "Jacket / blazer",
  kurta: "Kurta",
  dupatta: "Dupatta",
  accessory: "Accessory",
  tie: "Tie",
  watch: "Watch",
  belt: "Belt",
};

const formatPrice = (price: string | number) => `Rs. ${Number(price || 0).toLocaleString("en-PK")}`;

function toCartProduct(item: ApiItem): CartProduct {
  return {
    id: item.id,
    name: item.name,
    category: item.category || "Product",
    color: item.color_name || "",
    garment_type: item.slot || "",
    image: item.image || PLACEHOLDER_IMAGE,
    price: Number(item.price || 0),
    stock_quantity: Number(item.stock_quantity || 0),
    status: item.status || "Active",
  };
}

export default function CompleteOutfitView() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { addToCart } = useCart();
  const [searchParams] = useSearchParams();

  const productId = searchParams.get("productId");
  const depth = normalizeSkinTone(searchParams.get("skinTone") || user.contrastType || "medium");
  const undertone = searchParams.get("undertone") || profile?.undertone || "";
  // A unisex anchor carries no gender of its own, so tell the look engine whose body this is;
  // otherwise it happily pairs a men's shirt with a girls' skirt.
  const shopperGender = profile?.gender === "female" ? "women" : "men";

  const [look, setLook] = useState<CompleteLookResponse | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  // The shopper's chosen entry for each slot (default: the best pick). Keyed by kind or slot.
  const [chosen, setChosen] = useState<Record<string, LookEntry | null>>({});
  // The slot row the board is pointing at (a tile was clicked).
  const [highlight, setHighlight] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  const requestKey = `${productId}|${depth}|${undertone}|${shopperGender}`;
  const loading = Boolean(productId) && loadedFor !== requestKey;

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    recommenderApi
      .completeLook(productId, { depth, undertone, gender: shopperGender })
      .then((data) => {
        if (cancelled) return;
        setLook(data);
        setChosen(Object.fromEntries(data.slots.map((slot) => [slot.kind || slot.slot, slot.pick])));
        setErrorMessage("");
        setLoadedFor(requestKey);
      })
      .catch(() => {
        if (cancelled) return;
        setErrorMessage("We could not build a look for this product.");
        setLoadedFor(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, depth, undertone, shopperGender, requestKey]);

  const picked = useMemo(() => Object.values(chosen).filter((entry): entry is LookEntry => Boolean(entry)), [chosen]);
  const boardItems = useMemo(
    () =>
      look
        ? buildOutfitBoardTiles(
            look.anchor,
            look.anchor_slot,
            look.slots.map((slot) => ({ slot: slot.slot, kind: slot.kind, required: slot.required, pick: slot.pick })),
            chosen,
          )
        : [],
    [look, chosen],
  );

  const total = (look ? Number(look.anchor.price || 0) : 0) + picked.reduce((sum, entry) => sum + Number(entry.price || 0), 0);

  const selectFromBoard = (itemId: number) => {
    if (!look) return;
    const slot = look.slots.find((candidate) => [candidate.pick, ...candidate.swaps].some((entry) => entry?.id === itemId));
    const target = slot ? slot.kind || slot.slot : look.anchor.id === itemId ? "anchor" : null;
    if (!target) return;
    rowRefs.current[target]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(target);
    window.setTimeout(() => setHighlight((current) => (current === target ? null : current)), 1800);
  };

  const addWholeLook = () => {
    if (!look) return;
    [look.anchor, ...picked].forEach((item) => addToCart(toCartProduct(item)));
    notify("The whole look was added to your cart.");
  };

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base px-6 py-10 text-left font-sans">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-5 bg-white hover:bg-cream-card/60 border border-brand-border/60 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <p className="text-[10px] uppercase tracking-widest text-sage-green font-black mb-2">Complete the Outfit</p>
        <h1 className="text-3xl sm:text-5xl font-black text-brand-dark tracking-tight">
          {look ? LOOK_TITLES[look.look_type] : "Smart matching outfit"}
        </h1>
        <p className="text-sm text-slate-500 font-semibold mt-3 max-w-2xl">
          Pieces are matched on colour harmony, your skin tone and how formal the item is. Tap a swap to change a piece.
        </p>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-bold mt-6">{errorMessage}</div>
        )}

        {!productId ? (
          <div className="bg-white border border-brand-border/60 rounded-3xl p-12 text-center mt-8">
            <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-black text-brand-dark">No product selected</h3>
            <p className="text-sm text-slate-500 font-semibold mt-2">Pick a product on the recommended page and choose Complete Outfit.</p>
            <button
              onClick={() => navigate(`/recommended?skinTone=${depth}&undertone=${undertone}`)}
              className="mt-6 bg-brand-gold hover:opacity-90 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider"
            >
              Go to Recommended Products
            </button>
          </div>
        ) : loading ? (
          <div className="bg-white border border-brand-border/60 rounded-3xl p-12 text-center mt-8">
            <p className="text-sm font-black text-slate-700">Building your look...</p>
          </div>
        ) : look ? (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
            <div className="space-y-5">
            <section
              data-testid="look-slot-anchor"
              ref={(node) => {
                rowRefs.current["anchor"] = node;
              }}
              className={`bg-white border rounded-3xl p-5 transition-shadow ${highlight === "anchor" ? "border-brand-gold ring-2 ring-brand-gold" : "border-brand-border/60"}`}
            >
              <ItemRow title="Your pick" entry={look.anchor} note="The piece you started from." />
            </section>

            {look.slots.map((slot) => {
              const key = slot.kind || slot.slot;
              const options = [slot.pick, ...slot.swaps].filter((entry): entry is LookEntry => Boolean(entry));
              const current = chosen[key];
              return (
                <section
                  key={key}
                  data-testid={`look-slot-${key}`}
                  ref={(node) => {
                    rowRefs.current[key] = node;
                  }}
                  className={`bg-white border rounded-3xl p-5 transition-shadow ${highlight === key ? "border-brand-gold ring-2 ring-brand-gold" : "border-brand-border/60"}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">
                      {SLOT_TITLES[key] ?? key}
                      <span className="ml-2 text-[10px] text-slate-400">{slot.required ? "Required" : "Optional"}</span>
                    </h2>
                  </div>
                  {current ? (
                    <ItemRow entry={current} note={current.why} compact />
                  ) : (
                    <p className="text-sm text-slate-500 font-semibold">
                      {options.length === 0 ? "Nothing in stock matches this slot yet." : "Not included."}
                    </p>
                  )}
                  {options.length > 1 && (
                    <div className="mt-4 flex gap-3">
                      {options.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setChosen((previous) => ({ ...previous, [key]: option }))}
                          className={`w-20 rounded-xl overflow-hidden border-2 ${current?.id === option.id ? "border-emerald-600" : "border-slate-200"}`}
                          title={option.name}
                        >
                          <ProductImage src={option.image} alt={option.name} className="w-full h-24 bg-cream-card/60" />
                        </button>
                      ))}
                      {!slot.required && (
                        <button
                          type="button"
                          onClick={() => setChosen((previous) => ({ ...previous, [key]: null }))}
                          className="px-3 text-xs font-black uppercase tracking-wider text-slate-500 border-2 border-dashed border-slate-200 rounded-xl"
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}

            <div className="bg-slate-950 text-white rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Look total</p>
                <p data-testid="look-total" className="text-3xl font-black">{formatPrice(total)}</p>
                {!look.complete && (
                  <p className="text-xs text-amber-300 font-semibold mt-1">Missing in stock: {look.missing.join(", ")}</p>
                )}
              </div>
              <button
                onClick={addWholeLook}
                className="bg-brand-gold hover:opacity-90 text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Add whole look to cart
              </button>
            </div>
            </div>

            <div className="lg:sticky lg:top-24">
              <OutfitBoard items={boardItems} onSelect={selectFromBoard} />
              <p className="mt-3 text-xs text-slate-500 font-semibold text-center">
                Tap a piece on the board to find its row in the list.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ItemRow({ title, entry, note, compact }: { title?: string; entry: ApiItem; note?: string; compact?: boolean }) {
  return (
    <div className={compact ? "flex gap-4 items-center" : "bg-white border border-brand-border/60 rounded-3xl p-5 flex gap-5 items-center"}>
      <ProductImage
        src={entry.image}
        alt={entry.name}
        className={`${compact ? "w-24 h-28" : "w-28 h-32"} rounded-2xl bg-cream-card/60`}
      />
      <div className="min-w-0">
        {title && <p className="text-[10px] uppercase tracking-widest text-sage-green font-black mb-1">{title}</p>}
        <h3 className="text-sm font-black text-brand-dark">{entry.name}</h3>
        <p className="text-xs text-slate-500 font-bold mt-1">
          {entry.color_name || ""} {entry.color_name ? "·" : ""} {formatPrice(entry.price)}
        </p>
        {note && <p className="text-xs text-emerald-700 font-semibold mt-1.5">{note}</p>}
      </div>
    </div>
  );
}
