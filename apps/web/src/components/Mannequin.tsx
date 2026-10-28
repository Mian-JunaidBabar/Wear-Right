"use client";

import React from "react";
import { geometry, PRESET_LABELS, PRESETS, type BodyGender, type Layout, type Preset } from "@/features/mannequin/layout";
import type { Geometry } from "@/features/mannequin/geometry";
import { garmentPaths, shade } from "@/features/mannequin/garments";

const BODY_FILL = "#E9DFD3";
const BODY_OUTLINE = "#D4C6B5";
const SHADING_ID = "garment-shading";

type Props = {
  layout: Layout;
  gender: BodyGender;
  preset: Preset;
  onPreset: (preset: Preset) => void;
};

/** White and near-white garments need a darker outline to show against the light background. */
function isNearWhite(hex: string): boolean {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  return (r + g + b) / 3 > 225;
}

/** The legs: two filled shapes from hip through knee to ankle. */
function legPaths(g: Geometry): string[] {
  return ([0, 1] as const).map((side) => {
    const knee = g.knees[side];
    const ankle = g.ankles[side];
    const hip = side === 0 ? { x: g.hips.left + 2, y: 440 } : { x: g.hips.right - 2, y: 440 };
    return [
      `M${hip.x} ${hip.y}`,
      `L${knee.x - (side === 0 ? 13 : -13)} ${knee.y}`,
      `L${ankle.x - (side === 0 ? 11 : -11)} ${g.ankles[0].y + 2}`,
      `L${ankle.x + (side === 0 ? 11 : -11)} ${g.ankles[0].y + 2}`,
      `L${knee.x + (side === 0 ? 13 : -13)} ${knee.y}`,
      `L200 ${g.crotch.y + 4}`,
      "Z",
    ].join("");
  });
}

/** One arm: outer edge down, around the hand, back up the inner edge. */
function armPath(g: Geometry, side: 0 | 1): string {
  const out = side === 0 ? -1 : 1;
  const shoulder = g.shoulders[side];
  const elbow = g.elbows[side];
  const wrist = g.wrists[side];
  const hand = g.handsEnd[side];
  return [
    `M${shoulder.x + out * 9} ${shoulder.y - 4}`,
    `L${elbow.x + out * 8} ${elbow.y}`,
    `L${wrist.x + out * 7} ${wrist.y}`,
    `L${hand.x + out * 6} ${hand.y}`,
    `A9 9 0 0 ${side === 0 ? 1 : 0} ${hand.x - out * 4} ${hand.y - 4}`,
    `L${wrist.x - out * 7} ${wrist.y - 8}`,
    `L${elbow.x - out * 6} ${elbow.y - 8}`,
    `L${shoulder.x - out * 2} ${shoulder.y + 6}`,
    "Z",
  ].join("");
}

function Body({ g }: { g: Geometry }) {
  const headTop = 36; // head centre 72, r 36
  const headBottom = 108;
  return (
    <g data-testid="mannequin-body">
      {/* head, plain oval — no face, no hair */}
      <ellipse cx="200" cy={(headTop + headBottom) / 2} rx="32" ry="36" fill={BODY_FILL} stroke={BODY_OUTLINE} strokeWidth="1.5" />
      {/* neck */}
      <path d={`M186 106L214 106L214 130L186 130Z`} fill={BODY_FILL} stroke={BODY_OUTLINE} strokeWidth="1.5" />
      {/* torso: shoulders, waist taper, hips, pelvis */}
      <path
        d={[
          `M${g.shoulders[0].x} ${g.shoulders[0].y}`,
          `L${g.shoulders[1].x} ${g.shoulders[1].y}`,
          `L${g.waist.right} ${g.waist.y}`,
          `L${g.hips.right} ${g.hips.y}`,
          `L200 ${g.crotch.y}`,
          `L${g.hips.left} ${g.hips.y}`,
          `L${g.waist.left} ${g.waist.y}`,
          "Z",
        ].join("")}
        fill={BODY_FILL}
        stroke={BODY_OUTLINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* arms with rounded hands */}
      <path d={armPath(g, 0)} fill={BODY_FILL} stroke={BODY_OUTLINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={armPath(g, 1)} fill={BODY_FILL} stroke={BODY_OUTLINE} strokeWidth="1.5" strokeLinejoin="round" />
      {/* legs */}
      {legPaths(g).map((d, index) => (
        <path key={index} d={d} fill={BODY_FILL} stroke={BODY_OUTLINE} strokeWidth="1.5" strokeLinejoin="round" />
      ))}
      {/* subtle neck/shoulder seam so the body is not a flat cut-out */}
      <path d={`M${g.shoulders[0].x + 10} ${g.shoulders[0].y + 6}L${g.neck.left} ${g.neck.bottom}L${g.neck.right} ${g.neck.bottom}L${g.shoulders[1].x - 10} ${g.shoulders[1].y + 6}`} fill="none" stroke={BODY_OUTLINE} strokeWidth="1" opacity="0.7" />
      {/* wrist markers for the tests (the watch band sits on the left wrist) */}
      <circle data-part="wrist-left" cx={g.wrists[1].x} cy={g.wrists[1].y} r="1" fill="none" />
      <circle data-part="wrist-right" cx={g.wrists[0].x} cy={g.wrists[0].y} r="1" fill="none" />
      <circle data-part="waist-centre" cx="200" cy={g.waist.y} r="1" fill="none" />
    </g>
  );
}

/** The filled pieces, shading overlay and detail lines for one garment kind. */
function renderKind(kind: string, hex: string, g: Geometry) {
  const paths = garmentPaths(kind, g);
  if (paths.length === 0) return null;
  const outline = shade(hex, isNearWhite(hex) ? 0.45 : 0.3);
  const detail = shade(hex, 0.45);
  return paths.map((piece, index) => (
    <React.Fragment key={index}>
      <path
        data-foot={piece.foot}
        d={piece.d}
        fill={hex}
        stroke={outline}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d={piece.d} fill={`url(#${SHADING_ID})`} stroke="none" />
      {piece.details.length > 0 && (
        <path d={piece.details.join("")} fill="none" stroke={detail} strokeWidth="1.2" opacity="0.6" strokeLinecap="round" />
      )}
    </React.Fragment>
  ));
}

/** The flat 2D mannequin: one SVG body with the outfit drawn as coloured garment shapes. */
export default function Mannequin({ layout, gender, preset, onPreset }: Props) {
  const g = geometry(gender, preset);

  return (
    <div data-testid="mannequin-panel" className="bg-white border border-brand-border/60 rounded-3xl p-5">
      <div className="flex items-center justify-end mb-4">
        <div className="flex gap-2" role="group" aria-label="Body size">
          {PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              data-testid={`preset-${value}`}
              aria-pressed={preset === value}
              title={PRESET_LABELS[value]}
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

      <div data-testid="mannequin" className="mx-auto" style={{ maxWidth: 340 }}>
        <svg viewBox="0 0 400 800" className="w-full" role="img" aria-label="Outfit on a mannequin in your size">
          <defs>
            <linearGradient id={SHADING_ID} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="1" stopColor="rgba(0,0,0,0.12)" />
            </linearGradient>
          </defs>

          {/* floor shadow; no stand, no pole, no plinth */}
          <ellipse cx="200" cy={g.floor + 10} rx="112" ry="11" fill="#000" opacity="0.08" />

          <Body g={g} />

          {/* garments, back to front by z */}
          {layout.layers.map((layer) => (
            <g
              key={`${layer.kind}-${layer.id}`}
              data-testid="mannequin-layer"
              data-kind={layer.kind}
              data-slot={layer.slot}
              data-product-id={layer.id}
              data-anchor={layer.isAnchor ? "true" : "false"}
            >
              {renderKind(layer.kind, layer.hex, g)}
            </g>
          ))}
        </svg>
      </div>

      {layout.notShown.length > 0 && (
        <p data-testid="mannequin-notshown" className="text-xs text-slate-500 font-semibold mt-3">
          Not shown on the mannequin: {layout.notShown.map((item) => item.name).join(", ")}
        </p>
      )}
    </div>
  );
}
