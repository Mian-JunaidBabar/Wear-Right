/**
 * The mannequin's skeleton: named body points on a 400 x 800 canvas, per gender.
 *
 * Data only, no path strings — the garment shapes in garments.ts are generated from these
 * points, so every garment fits every body and preset. All x/y are canvas units.
 */

import type { BodyGender, Preset } from "./layout";

export type Point = { x: number; y: number };

export type Geometry = {
  gender: BodyGender;
  preset: Preset;
  head: { centre: Point; radius: number; sharedWidth: number };
  neck: { left: number; right: number; top: number; bottom: number };
  shoulders: [Point, Point];
  armpits: [Point, Point];
  elbows: [Point, Point];
  wrists: [Point, Point];
  handsEnd: [Point, Point];
  waist: { left: number; right: number; y: number };
  hips: { left: number; right: number; y: number };
  crotch: Point;
  knees: [Point, Point];
  ankles: [Point, Point];
  floor: number;
};

const BASE: Omit<Geometry, "gender" | "preset"> = {
  // 200, 72 — not quite a circle: rx 32 keeps the head slightly narrow like a fashion flat.
  head: { centre: { x: 200, y: 72 }, radius: 36, sharedWidth: 32 },
  neck: { left: 186, right: 214, top: 106, bottom: 126 },
  shoulders: [ { x: 128, y: 140 }, { x: 272, y: 140 } ],
  armpits: [ { x: 150, y: 190 }, { x: 250, y: 190 } ],
  elbows: [ { x: 104, y: 285 }, { x: 296, y: 285 } ],
  wrists: [ { x: 80, y: 395 }, { x: 320, y: 395 } ],
  handsEnd: [ { x: 72, y: 440 }, { x: 328, y: 440 } ],
  waist: { left: 150, right: 250, y: 375 },
  hips: { left: 142, right: 258, y: 430 },
  crotch: { x: 200, y: 470 },
  knees: [ { x: 165, y: 600 }, { x: 235, y: 600 } ],
  ankles: [ { x: 168, y: 740 }, { x: 232, y: 740 } ],
  floor: 778,
};

// Women: narrower shoulders, waist and hips; everything else is the same flat.
const WIDTHS: Record<BodyGender, { shoulder: number; waist: number; hip: number }> = {
  men: { shoulder: 128, waist: 150, hip: 142 },
  women: { shoulder: 136, waist: 158, hip: 136 },
};

/** How far a point may drift from the centre line for a body preset. */
const PRESET_SCALE: Record<Preset, number> = { slim: 0.9, regular: 1, plus: 1.15 };

function scaleAroundX(x: number, factor: number): number {
  //torso/hip/leg/arm widths scale; x=200 is the centre line.
  return Math.round(200 + (x - 200) * factor);
}

export function geometryFor(gender: BodyGender, preset: Preset): Geometry {
  const scale = PRESET_SCALE[preset];
  const width = WIDTHS[gender];
  const sx = (x: number) => scaleAroundX(x, scale);
  //The arms track the shoulders: widen the points by the shoulder delta, then scale.
  const armShift = width.shoulder - 128;
  //Waist/hip y's never move; only their x's (and, with them, the arms) widen.
  return {
    gender,
    preset,
    ...BASE,
    shoulders: [ { x: sx(width.shoulder), y: 140 }, { x: sx(400 - width.shoulder), y: 140 } ],
    armpits: [ { x: sx(width.shoulder + 22), y: 190 }, { x: sx(400 - width.shoulder - 22), y: 190 } ],
    wrists: [ { x: sx(BASE.wrists[0].x + armShift), y: 395 }, { x: sx(BASE.wrists[1].x - armShift), y: 395 } ],
    elbows: [ { x: sx(BASE.elbows[0].x + armShift), y: 285 }, { x: sx(BASE.elbows[1].x - armShift), y: 285 } ],
    handsEnd: [ { x: sx(BASE.handsEnd[0].x + armShift), y: 440 }, { x: sx(BASE.handsEnd[1].x - armShift), y: 440 } ],
    waist: { left: sx(width.waist), right: sx(400 - width.waist), y: 375 },
    hips: { left: sx(width.hip), right: sx(400 - width.hip), y: 430 },
    knees: [ { x: sx(BASE.knees[0].x), y: 600 }, { x: sx(BASE.knees[1].x), y: 600 } ],
    ankles: [ { x: sx(BASE.ankles[0].x), y: 740 }, { x: sx(BASE.ankles[1].x), y: 740 } ],
  };
}
