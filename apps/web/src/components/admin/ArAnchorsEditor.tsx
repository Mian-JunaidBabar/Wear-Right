"use client";

import React, { useRef, useState } from "react";
import type { AnchorPoint, GarmentAnchors } from "@/features/tryon/place";

type Props = {
  image: string | null;
  kind: string;
  anchors: GarmentAnchors;
  onChange: (anchors: GarmentAnchors) => void;
};

const KEYS: Record<string, string[]> = {
  top: ["l_shoulder", "r_shoulder", "hem_center"],
  bottom: ["l_waist", "r_waist", "hem_center"],
  footwear: ["heel", "toe"],
  watch: ["center"],
  cap: ["center"],
};

function family(kind: string): string {
  if (["tshirt", "shirt", "polo", "kurta", "kameez", "dress", "jacket", "blazer", "waistcoat", "hoodie"].includes(kind)) return "top";
  if (["jeans", "trousers", "shorts", "shalwar"].includes(kind)) return "bottom";
  if (["sneakers", "formal_shoes", "sandals", "boots"].includes(kind)) return "footwear";
  if (kind === "watch") return "watch";
  if (kind === "cap") return "cap";
  return "";
}

function isPoint(value: unknown): value is AnchorPoint {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number";
}

function familyName(kind: string): string {
  return { top: "Top", bottom: "Bottom", footwear: "Shoe", watch: "Watch", cap: "Cap" }[family(kind)] ?? "";
}

/**
 * Dots over the garment cut-out. Staff drag them onto the shoulders/waist/heel so a photo whose
 * alpha mask confuses the heuristic can still be made try-on ready.
 */
export default function ArAnchorsEditor({ image, kind, anchors, onChange }: Props) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const keys = KEYS[family(kind)] ?? [];

  if (!image) {
    return <p className="text-xs font-semibold text-slate-500">Add a product image, then save. Anchors can be set on the saved cut-out.</p>;
  }
  if (keys.length === 0) {
    return <p className="text-xs font-semibold text-slate-500">This garment type has no AR anchors.</p>;
  }
  if (keys.some((key) => !isPoint(anchors[key]))) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
        <p className="text-xs font-bold text-amber-800">No usable anchors yet.</p>
        <p className="text-xs font-semibold text-amber-700 mt-1">
          Run <code>make mannequin-assets</code> and <code>compute_tryon_anchors</code> after saving the cut-out.
        </p>
        {image && <img src={image} alt="Product cut-out" className="mt-3 max-h-40 rounded-lg object-contain bg-white" />}
      </div>
    );
  }

  const moveDot = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.min(size.width, Math.max(0, ((event.clientX - rect.left) / rect.width) * size.width));
    const y = Math.min(size.height, Math.max(0, ((event.clientY - rect.top) / rect.height) * size.height));
    onChange({ ...anchors, [dragging]: [Math.round(x), Math.round(y)] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">AR anchors · drag the dots</p>
        <p className="text-[10px] font-black text-slate-400">{familyName(kind)}</p>
      </div>
      <div
        className="relative inline-block max-w-full rounded-xl overflow-hidden border border-brand-border/60 bg-[repeating-conic-gradient(#f8fafc_0%_25%,#eef2f7_0%_50%)] bg-[length:16px_16px] touch-none"
        onPointerMove={moveDot}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        <img
          ref={imageRef}
          src={image}
          alt="Product cut-out for AR anchors"
          className="block max-h-64 w-auto max-w-full select-none"
          draggable={false}
          onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        />
        {keys.map((key) => {
          const point = anchors[key] as AnchorPoint;
          return (
            <button
              key={key}
              type="button"
              aria-label={`Move ${key} anchor`}
              title={key}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture?.(event.pointerId);
                setDragging(key);
              }}
              className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full bg-brand-gold border-2 border-white shadow-md cursor-grab active:cursor-grabbing"
              style={{ left: `${(point[0] / size.width) * 100}%`, top: `${(point[1] / size.height) * 100}%` }}
            >
              <span className="sr-only">{key}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500">
        {keys.map((key) => {
          const point = anchors[key] as AnchorPoint;
          return <span key={key}>{key.replaceAll("_", " ")}: {Math.round(point[0])}, {Math.round(point[1])}</span>;
        })}
      </div>
    </div>
  );
}
