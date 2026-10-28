"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ShoppingBag, X } from "lucide-react";
import { useNavigate } from "@/lib/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import { recommenderApi, type ApiItem, type CompleteLookResponse } from "@/features/recommender/api";
import { normalizeSkinTone } from "@/features/recommender/recommendationRules";
import { buildOutfitBoardTiles } from "@/features/outfit/board";
import OutfitBoard from "@/components/OutfitBoard";
import ProductImage from "@/components/ProductImage";

type Props = {
  productId: number | string;
  outOfStock: boolean;
  onClose: () => void;
  onOrder: () => void;
  onFullLook: () => void;
};

const SLOT_TITLES: Record<string, string> = {
  top: "Top", bottom: "Bottom", footwear: "Shoes", outerwear: "Jacket / blazer", kurta: "Kurta",
  dupatta: "Dupatta", accessory: "Accessory", tie: "Tie", watch: "Watch", belt: "Belt",
};

/** Quick look at a product's outfit board, opened from the shop. */
export default function OutfitPreviewModal({ productId, outOfStock, onClose, onOrder, onFullLook }: Props) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const depth = normalizeSkinTone(user.contrastType || "medium");
  const undertone = profile?.undertone || "";
  const shopperGender = profile?.gender === "female" ? "women" : "men";
  const [look, setLook] = useState<CompleteLookResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    recommenderApi
      .completeLook(productId, { depth, undertone, gender: shopperGender })
      .then((data) => !cancelled && setLook(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [productId, depth, undertone, shopperGender]);

  const rows: { title: string; item: ApiItem }[] = look
    ? [{ title: "Your pick", item: look.anchor }, ...look.slots.filter((s) => s.pick).map((s) => ({ title: SLOT_TITLES[s.kind || s.slot] ?? s.slot, item: s.pick as ApiItem }))]
    : [];

  const boardItems = useMemo(
    () =>
      look
        ? buildOutfitBoardTiles(
            look.anchor,
            look.anchor_slot,
            look.slots.map((slot) => ({ slot: slot.slot, kind: slot.kind, required: slot.required, pick: slot.pick })),
          )
        : [],
    [look],
  );

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4" role="dialog" aria-label="Outfit preview">
      <div className="bg-white max-w-5xl w-full max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl border border-brand-border/60 relative text-left">
        <button onClick={onClose} aria-label="Close preview" className="absolute top-4 right-4 bg-cream-card/60 hover:bg-slate-200 text-slate-600 rounded-full p-1.5 z-10 shadow cursor-pointer">
          <X className="w-4 h-4" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="bg-cream-base/60 p-6 flex items-start justify-center">
            {look ? (
              <OutfitBoard items={boardItems} className="w-full" onSelect={(itemId) => navigate(`/product/${itemId}`)} />
            ) : (
              <p className="py-24 text-sm font-bold text-slate-600">{failed ? "We could not build a preview for this product." : "Building your outfit board..."}</p>
            )}
          </div>

          <div className="p-8">
            <p className="text-[10px] uppercase text-sage-green font-extrabold tracking-widest">Outfit Preview</p>
            <h3 className="text-2xl font-bold text-brand-dark mt-1">See how this outfit goes together</h3>
            <p className="text-xs text-slate-500 font-semibold mt-2">
              The pieces are matched to your skin tone and laid out the way you wear them.
            </p>
            <div className="h-px bg-cream-card/60 my-6" />

            <div className="space-y-3">
              {rows.map(({ title, item }) => (
                <div key={`${title}-${item.id}`} className="flex items-center gap-4 bg-cream-base/60 rounded-xl p-3">
                  <ProductImage src={item.image} alt={item.name} className="w-14 h-16 rounded-lg bg-white" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">{title}</p>
                    <p className="text-sm font-bold text-brand-dark truncate">{item.name}</p>
                  </div>
                </div>
              ))}
              {look && look.missing.length > 0 && (
                <p className="text-xs text-amber-700 font-semibold">Nothing in stock for: {look.missing.join(", ")}.</p>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onFullLook}
                className="flex-1 border-2 border-slate-900 text-slate-900 text-xs font-bold uppercase tracking-wider py-3.5 rounded-xl hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
              >
                Swap pieces
              </button>
              <button
                onClick={onOrder}
                disabled={outOfStock}
                className={`flex-1 text-white text-xs font-bold uppercase tracking-wider py-3.5 rounded-xl flex items-center justify-center gap-2 ${
                  outOfStock ? "bg-slate-300 cursor-not-allowed" : "bg-brand-gold hover:opacity-90 cursor-pointer"
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-white/80" />
                {outOfStock ? "Out of Stock" : "Continue to Order"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
