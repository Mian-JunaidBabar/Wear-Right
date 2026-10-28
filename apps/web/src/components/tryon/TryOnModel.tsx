"use client";

import React, { useEffect, useMemo, useState } from "react";
import TryOnCanvas from "@/components/tryon/TryOnCanvas";
import type { ApiItem } from "@/features/recommender/api";
import { bodyFor, loadBodies, type BodyGender, type ModelBody } from "@/features/tryon/bodies";
import { garmentsFromItems, loadImage } from "@/features/tryon/items";
import type { Garment } from "@/features/tryon/place";
import type { Preset } from "@/features/mannequin/layout";

type Props = {
  items: ApiItem[];
  gender: BodyGender;
  preset: Preset;
  onPreset: (preset: Preset) => void;
  /** The SVG mannequin, shown when no piece has a usable cut-out. */
  fallback: React.ReactNode;
};

const PRESETS: Preset[] = ["slim", "regular", "plus"];

/**
 * The model-photo try-on shown in the shop preview and Complete Outfit panel.
 *
 * It uses the precomputed landmarks, so it is instant and needs no camera. If none of the pieces
 * has a cut-out (or the model assets fail to load), the caller's SVG mannequin stays in place.
 */
export default function TryOnModel({ items, gender, preset, onPreset, fallback }: Props) {
  const [bodies, setBodies] = useState<ModelBody[]>([]);
  const [bodyImage, setBodyImage] = useState<HTMLImageElement | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [unavailable, setUnavailable] = useState<ApiItem[]>([]);
  const keys = useMemo(() => items.map((item) => item.id).join(","), [items]);
  const body = bodyFor(bodies, gender, preset);

  useEffect(() => {
    let cancelled = false;
    loadBodies().then((rows) => !cancelled && setBodies(rows)).catch(() => !cancelled && setBodies([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!body) return;
    loadImage(body.image).then((image) => !cancelled && setBodyImage(image)).catch(() => !cancelled && setBodyImage(null));
    return () => {
      cancelled = true;
    };
  }, [body]);

  useEffect(() => {
    let cancelled = false;
    garmentsFromItems(items)
      .then((result) => {
        if (cancelled) return;
        setGarments(result.garments);
        setUnavailable(result.unavailable);
      })
      .catch(() => {
        if (cancelled) return;
        setGarments([]);
        setUnavailable(items);
      });
    return () => {
      cancelled = true;
    };
  }, [keys, items]);

  if (!bodyImage || garments.length === 0) return <>{fallback}</>;

  return (
    <div data-testid="tryon-model-panel" className="bg-white border border-brand-border/60 rounded-3xl p-5">
      <div className="flex items-center justify-end mb-4">
        <div className="flex gap-2" role="group" aria-label="Model body size">
          {PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={preset === value}
              onClick={() => onPreset(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border cursor-pointer ${
                preset === value ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <TryOnCanvas
        image={bodyImage}
        landmarks={body?.landmarks ?? null}
        garments={garments}
        label="Outfit on a model"
      />
      {unavailable.length > 0 && (
        <p className="text-xs text-slate-500 font-semibold mt-3">
          Not available for try-on: {unavailable.map((item) => item.name).join(", ")}
        </p>
      )}
    </div>
  );
}
