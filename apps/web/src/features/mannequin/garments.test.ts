import { describe, expect, it } from "vitest";
import { garmentPaths, type GarmentPath } from "./garments";
import { geometryFor, type Geometry } from "./geometry";

const KINDS = [
  "tshirt", "shirt", "polo", "kurta", "kameez", "dress", "jeans", "trousers", "shorts", "shalwar",
  "jacket", "hoodie", "blazer", "waistcoat", "dupatta", "belt", "tie", "sneakers", "formal_shoes",
  "boots", "sandals", "watch", "cap", "sunglasses",
];

const piecesOf = (paths: GarmentPath[]) => paths.filter((p) => !p.foot);
const feetOf = (paths: GarmentPath[]) => paths.filter((p) => p.foot);

/** crude bounds check: for this canvas every number in a path (coords and flags) is within range. */
const inCanvas = (p: GarmentPath) => {
  const nums = (p.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  expect(nums.length).toBeGreaterThan(0);
  for (const n of nums) {
    expect(n).toBeGreaterThanOrEqual(-1);
    expect(n).toBeLessThanOrEqual(801);
  }
};

/** parse all numbers out of an SVG path, treating `A r r 0 1 0 x y` arcs as just their endpoints. */
const coordsOf = (d: string): { xs: number[]; ys: number[] } => {
  const cleaned = d.replace(/A\s*-?\d+(?:\.\d+)?\s*-?\d+(?:\.\d+)?\s+0\s+1\s+0\s+/gi, "A");
  const nums = (cleaned.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.length % 2 !== 0) throw new Error(`odd coordinate count in path: ${d}`);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < nums.length; i += 2) {
    xs.push(nums[i]);
    ys.push(nums[i + 1]);
  }
  return { xs, ys };
};

const watchCoversLeftWrist = (paths: GarmentPath[], g: Geometry) => {
  const wrist = g.wrists[1]; // left wrist = viewer right
  return paths.some((p) => {
    const { xs, ys } = coordsOf(p.d);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return minX <= wrist.x && wrist.x <= maxX && minY <= wrist.y && wrist.y <= maxY;
  });
};

describe("garmentPaths", () => {
  it("gives every kind at least one shape for every gender and preset", () => {
    for (const gender of ["men", "women"] as const)
      for (const preset of ["slim", "regular", "plus"] as const) {
        const g = geometryFor(gender, preset);
        for (const kind of KINDS) {
          const paths = garmentPaths(kind, g);
          expect(paths.length, `${kind} ${gender}/${preset} has pieces`).toBeGreaterThan(0);
          for (const p of paths) {
            expect(p.d.length).toBeGreaterThan(0);
            inCanvas(p);
          }
        }
      }
  });

  it("draws exactly two shoes with left and right feet", () => {
    for (const gender of ["men", "women"] as const)
      for (const preset of ["slim", "regular", "plus"] as const) {
        const g = geometryFor(gender, preset);
        for (const kind of ["sneakers", "formal_shoes", "boots", "sandals"]) {
          const feet = feetOf(garmentPaths(kind, g));
          expect(feet).toHaveLength(2);
          expect(feet.map((f) => f.foot).sort()).toEqual(["left", "right"]);
        }
      }
  });

  it("never gives a foot to a non-shoe kind", () => {
    const g = geometryFor("men", "regular");
    for (const kind of KINDS.filter((k) => !["sneakers", "formal_shoes", "boots", "sandals"].includes(k))) {
      expect(feetOf(garmentPaths(kind, g))).toHaveLength(0);
    }
  });

  it("sits shoes on the floor", () => {
    const g = geometryFor("men", "regular");
    for (const kind of ["sneakers", "formal_shoes", "boots", "sandals"]) {
      for (const piece of piecesOf(garmentPaths(kind, g))) {
        const { ys } = coordsOf(piece.d);
        expect(Math.max(...ys)).toBeGreaterThanOrEqual(g.floor - 1);
      }
    }
  });

  it("puts the watch strap around the left wrist", () => {
    for (const gender of ["men", "women"] as const)
      for (const preset of ["slim", "regular", "plus"] as const) {
        const g = geometryFor(gender, preset);
        expect(watchCoversLeftWrist(garmentPaths("watch", g), g)).toBe(true);
      }
  });

  it("dresses nobody in a bag", () => {
    const g = geometryFor("men", "regular");
    expect(garmentPaths("bag", g)).toEqual([]);
    expect(garmentPaths("anything-else", g)).toEqual([]);
  });

  it("builds different silhouettes per kind (a dress is not a tshirt)", () => {
    const g = geometryFor("men", "regular");
    expect(garmentPaths("dress", g)[0].d).not.toBe(garmentPaths("tshirt", g)[0].d);
    expect(garmentPaths("jeans", g)[0].d).not.toBe(garmentPaths("shorts", g)[0].d);
  });

  it("adapts the same kind to body shape", () => {
    const slim = garmentPaths("shirt", geometryFor("men", "slim"))[0].d;
    const plus = garmentPaths("shirt", geometryFor("men", "plus"))[0].d;
    expect(slim).not.toBe(plus);
  });
});
