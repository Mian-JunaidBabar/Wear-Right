/**
 * Garment shapes for the flat 2D mannequin: SVG path data generated from body geometry.
 *
 * Pure functions: shapes are built from the geometry points (geometry.ts), so every garment fits
 * every gender and preset with no per-image coordinates. A garment is a list of filled pieces;
 * `details` are stroked seam/collar/placket lines drawn on top of the piece. Shoes are TWO
 * pieces, one per foot, marked with `foot`. Kinds with no shape (bag, unknown) return [] so the
 * layout lists them instead of drawing them.
 */

import type { Geometry } from "./geometry";

export type GarmentPath = { d: string; details: string[]; foot?: "left" | "right" };

const num = (value: number) => Math.round(value * 10) / 10;

/** Darken a hex colour by `amount` (0–1): 0.3 → outline, 0.45 → detail lines. */
export function shade(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  const darken = (value: number) => Math.round(value * (1 - amount));
  return `#${[darken(r), darken(g), darken(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

type Pt = { x: number; y: number };

const poly = (points: Pt[]) => `M${points.map((p) => `${num(p.x)} ${num(p.y)}`).join("L")}Z`;
const stroked = (points: Pt[]) => `M${points.map((p) => `${num(p.x)} ${num(p.y)}`).join("L")}`;

const circle = (c: Pt, r: number) =>
  `M${num(c.x - r)} ${num(c.y)}A${num(r)} ${num(r)} 0 1 0 ${num(c.x + r)} ${num(c.y)}A${num(r)} ${num(r)} 0 1 0 ${num(c.x - r)} ${num(c.y)}Z`;

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** The point at a given height down the arm from the shoulder towards the wrist. */
function onArm(shoulder: Pt, wrist: Pt, y: number): Pt {
  const t = Math.max(0, Math.min(1, (y - shoulder.y) / (wrist.y - shoulder.y)));
  return lerp(shoulder, wrist, t);
}

/** One sleeve: a band along the arm (x-offset band; the arms hang almost vertical). */
function sleeve(g: Geometry, side: 0 | 1, endY: number, band: number): string {
  const out = side === 0 ? -1 : 1;
  const shoulder = g.shoulders[side];
  const elbow = g.elbows[side];
  const wrist = g.wrists[side];
  const end = onArm(shoulder, wrist, endY);
  return poly([
    { x: shoulder.x + out * band, y: shoulder.y - 2 },
    { x: elbow.x + out * band * 0.9, y: elbow.y },
    { x: end.x + out * band * 0.7, y: end.y },
    { x: end.x - out * band * 0.55, y: end.y },
    { x: elbow.x - out * band * 0.5, y: elbow.y + 6 },
    { x: g.armpits[side].x - out * band * 0.35, y: g.armpits[side].y + 10 },
  ]);
}

/**
 * Torso silhouette for tops: shoulders with a scooped neck, armholes, side seams and a hem.
 * Drawn after the sleeves so the body covers the sleeve's inner seam.
 */
function torso(g: Geometry, hemY: number, opts: { flare?: number; dip?: number } = {}): string {
  const flare = opts.flare ?? 0;
  const dip = opts.dip ?? 148;
  const sl = g.shoulders[0], sr = g.shoulders[1];
  const aL = g.armpits[0], aR = g.armpits[1];
  const hemL = { x: g.hips.left - flare, y: hemY };
  const hemR = { x: g.hips.right + flare, y: hemY };
  const cR = lerp(sr, aR, 0.5), cL = lerp(sl, aL, 0.5);
  return (
    stroked([sl, { x: g.neck.left + 4, y: g.neck.bottom }]) +
    `Q${num(200)} ${num(dip)} ${num(g.neck.right - 4)} ${num(g.neck.bottom)}` +
    `L${num(sr.x)} ${num(sr.y)}` +
    `Q${num(cR.x + 14)} ${num(cR.y)} ${num(aR.x)} ${num(aR.y)}` +
    `L${num(hemR.x)} ${num(hemR.y)}` +
    `L${num(hemL.x)} ${num(hemL.y)}` +
    `L${num(aL.x)} ${num(aL.y)}` +
    `Q${num(cL.x - 14)} ${num(cL.y)} ${num(sl.x)} ${num(sl.y)}` +
    "Z"
  );
}

/**
 * Both legs in one silhouette: outer edges, two hems, inner seams meeting at the crotch,
 * and a straight waistband edge across the top (the extra `w` widens shorts and shalwar).
 */
function pants(g: Geometry, hemY: number, w: { knee: number; hem: number }): string {
  const kl = g.knees[0], kr = g.knees[1];
  const al = g.ankles[0], ar = g.ankles[1];
  return (
    stroked([{ x: g.waist.left, y: g.waist.y }, { x: kl.x - w.knee, y: kl.y }, { x: al.x - w.hem, y: hemY }]) +
    `L${num(al.x + w.hem)} ${num(hemY)}` +
    `L${num(g.crotch.x)} ${num(g.crotch.y)}` +
    `L${num(ar.x - w.hem)} ${num(hemY)}` +
    `L${num(ar.x + w.hem)} ${num(hemY)}` +
    `L${num(kr.x + w.knee)} ${num(kr.y)}` +
    `L${num(g.waist.right)} ${num(g.waist.y)}` +
    "Z"
  );
}

/**
 * A filled front panel for open-front garments (jacket, blazer, waistcoat): shoulder, collar
 * corner, the V tip at `vDepth`, down the inner edge to the hem, out to the side seam, close.
 */
function frontPanel(g: Geometry, side: 0 | 1, hemY: number, vDepth: number): string {
  const out = side === 0 ? -1 : 1;
  const shoulder = g.shoulders[side];
  const armpit = g.armpits[side];
  const neckX = side === 0 ? g.neck.left + 4 : g.neck.right - 4;
  const hemX = side === 0 ? g.hips.left : g.hips.right;
  const centreX = 200 + out * 5;
  return poly([
    shoulder,
    { x: neckX, y: g.neck.bottom },
    { x: centreX, y: vDepth },
    { x: centreX + out * 4, y: hemY - 30 },
    { x: hemX + out * 2, y: hemY },
    armpit,
  ]);
}

/** Blazer lapel: a filled triangle across the chest from the collar to the V tip. */
function lapel(g: Geometry, side: 0 | 1, vDepth: number): string {
  const out = side === 0 ? -1 : 1;
  const neckX = side === 0 ? g.neck.left + 4 : g.neck.right - 4;
  return poly([
    { x: g.shoulders[side].x + out * 26, y: g.shoulders[side].y + 10 },
    { x: 200 + out * 6, y: vDepth },
    { x: neckX, y: g.neck.bottom + 6 },
  ]);
}

/** One shoe: sole on the floor plus an upper around the ankle, toes pointing outward. */
function shoe(g: Geometry, side: 0 | 1, upperTop: number): GarmentPath {
  const a = g.ankles[side];
  const out = side === 0 ? -1 : 1; // toes point out, heels in
  const floor = g.floor;
  const heelX = a.x - out * 12;
  const toeX = a.x + out * 28;
  const sole = poly([
    { x: heelX, y: floor },
    { x: heelX, y: floor - 10 },
    { x: toeX - out * 6, y: floor - 6 },
    { x: toeX, y: floor },
  ]);
  const upper = poly([
    { x: heelX, y: floor - 10 },
    { x: heelX, y: upperTop + 8 },
    { x: a.x - out * 10, y: upperTop },
    { x: a.x + out * 12, y: floor - 6 },
    { x: toeX - out * 6, y: floor - 6 },
  ]);
  const laces = [
    stroked([{ x: a.x + out * 6, y: upperTop + 12 }, { x: a.x - out * 6, y: upperTop + 20 }]),
    stroked([{ x: a.x + out * 10, y: upperTop + 22 }, { x: a.x - out * 2, y: upperTop + 30 }]),
  ];
  return { d: `${sole}${upper}`, details: laces, foot: side === 0 ? "left" : "right" };
}

function sandals(g: Geometry, side: 0 | 1): GarmentPath {
  const a = g.ankles[side];
  const out = side === 0 ? -1 : 1;
  const floor = g.floor;
  const heelX = a.x - out * 10;
  const toeX = a.x + out * 24;
  const sole = poly([
    { x: heelX, y: floor },
    { x: heelX, y: floor - 5 },
    { x: toeX, y: floor - 5 },
    { x: toeX, y: floor },
  ]);
  const straps = [
    stroked([{ x: a.x - out * 14, y: floor - 14 }, { x: a.x + out * 8, y: floor - 6 }]),
    stroked([{ x: a.x + out * 4, y: floor - 16 }, { x: a.x + out * 20, y: floor - 6 }]),
  ];
  return { d: sole, details: straps, foot: side === 0 ? "left" : "right" };
}

function boots(g: Geometry, side: 0 | 1): GarmentPath[] {
  const a = g.ankles[side];
  const out = side === 0 ? -1 : 1;
  const cuffY = 700;
  const upper = poly([
    { x: a.x - out * 16, y: cuffY },
    { x: a.x - out * 16, y: 738 },
    { x: a.x + out * 14, y: 750 },
    { x: a.x + out * 18, y: g.floor - 8 },
  ]);
  const shoe = shoeShape(g, side, cuffY + 34);
  return [{ d: upper + shoe.d, details: [stroked([{ x: a.x - out * 16, y: cuffY + 6 }, { x: a.x + out * 16, y: cuffY + 6 }])], foot: shoe.foot }];
}

function shoeShape(g: Geometry, side: 0 | 1, upperTop: number): GarmentPath {
  return shoe(g, side, upperTop);
}

/* ------------------------------- the garments ------------------------------- */

export function garmentPaths(kind: string, g: Geometry): GarmentPath[] {
  switch (kind) {
    case "tshirt":
      return [
        { d: sleeve(g, 0, 252, 17), details: [] },
        { d: sleeve(g, 1, 252, 17), details: [] },
        { d: torso(g, 455, { flare: 4 }), details: [] },
      ];

    case "polo":
      return [
        { d: sleeve(g, 0, 252, 17), details: [] },
        { d: sleeve(g, 1, 252, 17), details: [] },
        {
          d: torso(g, 458, { flare: 4 }),
          details: [
            stroked([{ x: g.neck.left + 2, y: g.neck.bottom }, { x: 196, y: 146 }]),
            stroked([{ x: g.neck.right - 2, y: g.neck.bottom }, { x: 204, y: 146 }]),
            stroked([{ x: 200, y: 146 }, { x: 200, y: 214 }]),
            circle({ x: 200, y: 166 }, 1.5),
            circle({ x: 200, y: 186 }, 1.5),
          ],
        },
      ];

    case "shirt": {
      const placket = [148, 200, 252, 304, 356, 408].map((y) =>
        stroked([{ x: 198, y }, { x: 202, y }]),
      );
      return [
        { d: sleeve(g, 0, 392, 13), details: [] },
        { d: sleeve(g, 1, 392, 13), details: [] },
        {
          d: torso(g, 465, { flare: 2, dip: 142 }),
          details: [
            stroked([{ x: g.neck.left, y: g.neck.bottom }, { x: 178, y: 146 }]),
            stroked([{ x: g.neck.right, y: g.neck.bottom }, { x: 222, y: 146 }]),
            stroked([{ x: 200, y: 144 }, { x: 200, y: 460 }]),
            ...placket,
          ],
        },
      ];
    }

    case "kurta":
    case "kameez": {
      const placket = [150, 200, 250].map((y) => stroked([{ x: 198, y }, { x: 202, y }]));
      return [
        { d: sleeve(g, 0, 392, 13), details: [] },
        { d: sleeve(g, 1, 392, 13), details: [] },
        {
          d: torso(g, 610, { flare: 8, dip: 140 }),
          details: [
            // band collar
            stroked([{ x: g.neck.left, y: g.neck.bottom + 2 }, { x: g.neck.right, y: g.neck.bottom + 2 }]),
            stroked([{ x: 200, y: g.neck.bottom + 2 }, { x: 200, y: 280 }]),
            ...placket,
            // side slits
            stroked([{ x: g.hips.left + 16, y: 560 }, { x: g.hips.left + 16, y: 610 }]),
            stroked([{ x: g.hips.right - 16, y: 560 }, { x: g.hips.right - 16, y: 610 }]),
          ],
        },
      ];
    }

    case "dress":
      return [{ d: torso(g, 640, { flare: 16 }), details: [stroked([{ x: g.waist.left, y: g.waist.y }, { x: g.waist.right, y: g.waist.y }])] }];

    case "jeans": {
      const pocket = (side: 0 | 1) => {
        const sx = side === 0 ? g.waist.left + 6 : g.waist.right - 6;
        const out = side === 0 ? -1 : 1;
        return stroked([{ x: sx, y: g.waist.y + 4 }, { x: sx - out * 20, y: g.waist.y + 22 }, { x: sx - out * 24, y: g.waist.y + 40 }]);
      };
      return [
        {
          d: pants(g, 742, { knee: 15, hem: 13 }),
          details: [
            stroked([{ x: 200, y: g.waist.y + 6 }, { x: 200, y: 430 }]), // fly
            stroked([{ x: g.waist.left, y: g.waist.y + 14 }, { x: g.waist.right, y: g.waist.y + 14 }]), // waistband
            pocket(0),
            pocket(1),
          ],
        },
      ];
    }

    case "trousers":
      return [
        {
          d: pants(g, 740, { knee: 14, hem: 12 }),
          details: [
            stroked([{ x: 200, y: g.waist.y + 6 }, { x: 200, y: 452 }]), // fly
            // centre creases
            stroked([{ x: g.knees[0].x, y: 500 }, { x: g.ankles[0].x, y: 726 }]),
            stroked([{ x: g.knees[1].x, y: 500 }, { x: g.ankles[1].x, y: 726 }]),
          ],
        },
      ];

    case "shorts":
      return [
        {
          d: pants(g, 540, { knee: 18, hem: 16 }),
          details: [
            stroked([{ x: g.knees[0].x - 18, y: 540 }, { x: g.knees[0].x + 16, y: 540 }]),
            stroked([{ x: g.knees[1].x - 16, y: 540 }, { x: g.knees[1].x + 18, y: 540 }]),
          ],
        },
      ];

    case "shalwar":
      return [
        {
          d: pants(g, 742, { knee: 19, hem: 21 }),
          details: [
            stroked([{ x: g.ankles[0].x - 21, y: 716 }, { x: g.ankles[0].x + 21, y: 716 }]),
            stroked([{ x: g.ankles[0].x - 19, y: 730 }, { x: g.ankles[0].x + 19, y: 730 }]),
            stroked([{ x: g.ankles[1].x - 21, y: 716 }, { x: g.ankles[1].x + 21, y: 716 }]),
            stroked([{ x: g.ankles[1].x - 19, y: 730 }, { x: g.ankles[1].x + 19, y: 730 }]),
          ],
        },
      ];

    case "jacket": {
      const sleeves = ([0, 1] as const).map((side) => ({ d: sleeve(g, side, 392, 14), details: [] }));
      const panels = ([0, 1] as const).map((side) => {
        const out = side === 0 ? -1 : 1;
        const hemY = 470;
        const centreX = 200 + out * 5;
        return {
          d: frontPanel(g, side, hemY, 190),
          details: [stroked([{ x: centreX + out * 4, y: 220 }, { x: centreX + out * 4, y: hemY - 30 }])],
        };
      });
      return [...sleeves, ...panels];
    }

    case "hoodie": {
      const hood =
        `M${num(g.neck.left - 10)} 146Q${num(200)} 184 ${num(g.neck.right + 10)} 146`;
      return [
        { d: sleeve(g, 0, 392, 14), details: [] },
        { d: sleeve(g, 1, 392, 14), details: [] },
        {
          d: torso(g, 465, { flare: 3, dip: 152 }),
          details: [
            hood,
            // kangaroo pocket
            `M${num(g.waist.left + 34)} 392L${num(g.hips.left + 44)} 448L${num(g.hips.right - 44)} 448L${num(g.waist.right - 34)} 392`,
            // drawstrings
            stroked([{ x: 192, y: 150 }, { x: 190, y: 190 }]),
            stroked([{ x: 208, y: 150 }, { x: 210, y: 190 }]),
          ],
        },
      ];
    }

    case "blazer": {
      const sleeves = ([0, 1] as const).map((side) => ({ d: sleeve(g, side, 392, 14), details: [] }));
      const lapels = ([0, 1] as const).map((side) => ({ d: lapel(g, side, 212), details: [] }));
      const panels = ([0, 1] as const).map((side) => ({ d: frontPanel(g, side, 470, 212), details: [] }));
      return [...sleeves, ...panels, ...lapels];
    }

    case "waistcoat": {
      const panels = ([0, 1] as const).map((side) => {
        const out = side === 0 ? -1 : 1;
        const centreX = 200 + out * 5;
        return {
          d: frontPanel(g, side, 470, 250),
          details: [stroked([{ x: centreX + out * 4, y: 270 }, { x: centreX + out * 4, y: 440 }])],
        };
      });
      return panels;
    }

    case "dupatta": {
      const a = { x: g.shoulders[0].x + 16, y: 150 };
      const b = { x: g.hips.right - 6, y: 398 };
      const d = { x: g.hips.right - 2, y: 472 };
      const e = { x: b.x - 16, y: 452 };
      const a2 = { x: a.x - 12, y: a.y + 10 };
      return [
        {
          d: poly([a, b, d, e, a2]),
          details: [stroked([lerp(a2, d, 0.18), lerp(a2, d, 0.5), lerp(a2, d, 0.8)])],
        },
      ];
    }

    case "belt": {
      const y = 375;
      return [
        {
          d: poly([
            { x: g.waist.left - 4, y: y - 8 },
            { x: g.waist.right + 4, y: y - 8 },
            { x: g.waist.right + 4, y: y + 8 },
            { x: g.waist.left - 4, y: y + 8 },
          ]),
          details: [`M${num(194)} ${num(y - 8)}L${num(206)} ${num(y + 8)}M${num(206)} ${num(y - 8)}L${num(194)} ${num(y + 8)}`],
        },
      ];
    }

    case "tie": {
      const knot = poly([
        { x: 200, y: 148 }, { x: 208, y: 158 }, { x: 200, y: 168 }, { x: 192, y: 158 },
      ]);
      const blade = poly([
        { x: 194, y: 162 }, { x: 206, y: 162 }, { x: 203, y: 376 }, { x: 200, y: 386 }, { x: 197, y: 376 },
      ]);
      return [{ d: `${knot}${blade}`, details: [] }];
    }

    case "sneakers":
      return [shoe(g, 0, 740), shoe(g, 1, 740)];

    case "formal_shoes":
      return ([0, 1] as const).map((side) => {
        const s = shoe(g, side, 752);
        const a = g.ankles[side];
        return { ...s, details: [stroked([{ x: a.x - (side === 0 ? -1 : 1) * 14, y: 758 }, { x: a.x + (side === 0 ? -1 : 1) * 16, y: 772 }])] };
      });

    case "boots":
      return [...boots(g, 0), ...boots(g, 1)];

    case "sandals":
      return [sandals(g, 0), sandals(g, 1)];

    case "watch": {
      // LEFT wrist = viewer's right.
      const w = g.wrists[1];
      const e = g.elbows[1];
      const d = { x: w.x - e.x, y: w.y - e.y };
      const len = Math.hypot(d.x, d.y) || 1;
      const u = { x: d.x / len, y: d.y / len }; // along the arm
      const n = { x: u.y, y: -u.x };            // across the wrist
      const at = (alongN: number, alongU: number): Pt => ({ x: w.x + n.x * alongN + u.x * alongU, y: w.y + n.y * alongN + u.y * alongU });
      const strap = poly([at(14, 6), at(14, -6), at(-14, -6), at(-14, 6)]);
      return [{ d: `${strap}${circle(w, 8)}`, details: [circle(w, 5)] }];
    }

    case "cap": {
      const crown = `M${num(166)} 64A34 34 0 0 1 ${num(234)} 64Z`;
      const brim = poly([
        { x: 158, y: 64 }, { x: 242, y: 64 }, { x: 236, y: 72 }, { x: 164, y: 72 },
      ]);
      return [{ d: `${crown}${brim}`, details: [stroked([{ x: 168, y: 60 }, { x: 232, y: 60 }])] }];
    }

    case "sunglasses": {
      const eyeY = 76;
      const left = circle({ x: 181, y: eyeY }, 10);
      const right = circle({ x: 219, y: eyeY }, 10);
      return [
        {
          d: `${left}${right}`,
          details: [stroked([{ x: 191, y: eyeY - 2 }, { x: 209, y: eyeY - 2 }]), stroked([{ x: 171, y: eyeY - 4 }, { x: 163, y: eyeY - 8 }]), stroked([{ x: 229, y: eyeY - 4 }, { x: 237, y: eyeY - 8 }])],
        },
      ];
    }

    // Bags have no place on the body; the layout lists them below the mannequin instead.
    case "bag":
      return [];

    default:
      return [];
  }
}
