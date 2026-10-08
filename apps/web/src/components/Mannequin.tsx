"use client";

import React from "react";
import { PRESET_LABELS, PRESETS, type Angle, type Layout, type Preset } from "@/features/mannequin/layout";

type Props = {
  layout: Layout;
  angle: Angle;
  preset: Preset;
  onAngle: (angle: Angle) => void;
  onPreset: (preset: Preset) => void;
};

const OBJECT_POSITION = { top: "center top", bottom: "center bottom", center: "center center" } as const;

/** The 2D mannequin: a body image with each garment cut-out absolutely positioned in its slot box. */
export default function Mannequin({ layout, angle, preset, onAngle, onPreset }: Props) {
  return (
    <div data-testid="mannequin-panel" className="bg-white border border-brand-border/60 rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2" role="group" aria-label="View angle">
          {(["front", "back"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={angle === value}
              onClick={() => onAngle(value)}
              className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                angle === value ? "bg-slate-950 text-white border-slate-950" : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="flex gap-2" role="group" aria-label="Body size">
          {PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={preset === value}
              title={PRESET_LABELS[value]}
              onClick={() => onPreset(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                preset === value ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto bg-cream-card/40 rounded-2xl" style={{ width: "100%", maxWidth: 300 }}>
        <div data-testid="mannequin" data-body={layout.body} className="relative w-full" style={{ aspectRatio: "1 / 2" }}>
          <img src={layout.body} alt="Mannequin" className="absolute inset-0 w-full h-full" draggable={false} />
          {layout.layers.map((layer) => (
            <img
              key={`${layer.slot}-${layer.id}`}
              data-testid="mannequin-layer"
              data-slot={layer.slot}
              src={layer.src}
              alt={layer.name}
              draggable={false}
              className="absolute"
              style={{
                left: `${layer.left}%`,
                top: `${layer.top}%`,
                width: `${layer.width}%`,
                height: `${layer.height}%`,
                zIndex: layer.z,
                objectFit: "contain",
                objectPosition: OBJECT_POSITION[layer.align],
              }}
            />
          ))}
        </div>
      </div>

      {layout.notes.map((note) => (
        <p key={note} data-testid="mannequin-note" className="text-xs text-slate-500 font-semibold mt-3">{note}</p>
      ))}
      {layout.skipped.length > 0 && (
        <ul data-testid="mannequin-skipped" className="mt-3 space-y-1">
          {layout.skipped.map((item) => (
            <li key={item.id} className="text-xs text-amber-700 font-semibold">
              {item.name}: {item.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
