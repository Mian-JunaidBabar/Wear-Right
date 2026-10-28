import { describe, expect, it } from "vitest";
import type { ApiItem } from "@/features/recommender/api";
import { geometry, kindOf, layoutLook, presetFromWaist, PRESETS } from "./layout";

let nextId = 1;
const item = (kind: string, extra: Partial<ApiItem> = {}): ApiItem => ({
  id: nextId++,
  name: `${kind} ${nextId}`,
  kind: extra.kind ?? kind,
  slot: extra.slot ?? null,
  display_hex: "#112233",
  price: 1000,
  ...extra,
});

const menGeometry = geometry("men", "regular");
const womenGeometry = geometry("women", "regular");

describe("presetFromWaist", () => {
  it.each([[30, "slim"], [32, "slim"], [33, "slim"], [34, "regular"], [38, "regular"], [39, "plus"], [44, "plus"]])("%i inches is %s", (inches, preset) => {
    expect(presetFromWaist(inches)).toBe(preset);
  });
});

describe("geometry", () => {
  it("stays inside the 400x800 canvas and keeps heights constant across sizes", () => {
    for (const gender of ["men", "women"] as const)
      for (const preset of PRESETS) {
        const g = geometry(gender, preset);
        for (const y of [g.head.centre.y, g.shoulders[0].y, g.waist.y, g.hips.y, g.crotch.y, g.knees[0].y, g.ankles[0].y, g.floor]) {
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(800);
        }
        for (const p of [...g.shoulders, ...g.wrists, g.crotch]) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(400);
        }
        // heights do not change between sizes
      }
    expect(geometry("men", "slim").floor).toBe(menGeometry.floor);
    expect(geometry("men", "plus").shoulders[0].y).toBe(menGeometry.shoulders[0].y);
  });

  it("scales the torso, not the arms, between sizes", () => {
    const slim = geometry("men", "slim");
    const plus = geometry("men", "plus");
    expect(slim.shoulders[0].x).toBeGreaterThan(menGeometry.shoulders[0].x);
    expect(plus.shoulders[0].x).toBeLessThan(menGeometry.shoulders[0].x);  });

  it("gives women a narrower waist and wider hips than men", () => {
    expect(womenGeometry.waist.left).toBeGreaterThan(menGeometry.waist.left);
    expect(womenGeometry.hips.left).toBeLessThan(menGeometry.hips.left);
  });
});

describe("kindOf", () => {
  it("uses the product kind when it is drawable", () => {
    expect(kindOf({ slot: "top", name: "Whatever", kind: "polo" })).toBe("polo");
  });

  it("reads accessories from the name when the slot is accessory", () => {
    expect(kindOf({ slot: "accessory", name: "Fastrack Black Watch", kind: null })).toBe("watch");
    expect(kindOf({ slot: "accessory", name: "Silk Tie", kind: null })).toBe("tie");
    expect(kindOf({ slot: "accessory", name: "Aviator Sunglasses", kind: null })).toBe("sunglasses");
    expect(kindOf({ slot: "accessory", name: "Mystery thing", kind: null })).toBe("");
  });

  it("falls back to a coarse shape from the slot", () => {
    expect(kindOf({ slot: "top", name: "Untagged", kind: null })).toBe("shirt");
    expect(kindOf({ slot: "bottom", name: "Untagged", kind: null })).toBe("trousers");
    expect(kindOf({ slot: "footwear", name: "Untagged", kind: null })).toBe("sneakers");
    expect(kindOf({ slot: null, name: "Untagged", kind: null })).toBe("");
  });
});

describe("layoutLook", () => {
  it("orders layers by z (bottom below top below outerwear below shoes below accessories)", () => {
    const { layers } = layoutLook(
      item("shirt", { slot: "top" }),
      [
        item("sneakers", { slot: "footwear" }),
        item("hoodie", { slot: "outerwear" }),
        item("jeans", { slot: "bottom" }),
        item("watch", { slot: "accessory", name: "Black Watch" }),
      ],
      "men",
      "regular",
    );
    expect(layers.map((l) => l.kind)).toEqual(["jeans", "shirt", "hoodie", "sneakers", "watch"]);
    expect(layers.map((l) => l.isAnchor)).toEqual([false, true, false, false, false]);
  });

  it("colors every layer with the product colour", () => {
    const anchor = item("kurta", { slot: "kurta", display_hex: "#aa0000" });
    const { layers } = layoutLook(anchor, [], "women", "regular");
    expect(layers[0].hex).toBe("#aa0000");
  });

  it("always draws the anchor, even when nothing else fits yet", () => {
    const { layers } = layoutLook(item("polo", { slot: "top" }), [], "men", "regular");
    expect(layers.map((l) => l.kind)).toEqual(["polo"]);
    expect(layers[0].isAnchor).toBe(true);
  });

  it("lists a second piece on one layer under the body (the anchor wins its layer)", () => {
    const polo = item("polo", { slot: "top" });
    const result = layoutLook(
      item("shirt", { slot: "top" }),
      [polo, item("watch", { slot: "accessory", name: "Watch" })],
      "men",
      "regular",
    );
    expect(result.layers.map((l) => l.kind)).toEqual(["shirt", "watch"]);
    expect(result.notShown).toEqual([{ id: polo.id, name: polo.name }]);
  });

  it("lists products with no drawable shape (bags) under the body", () => {
    const bag = item("bag", { slot: "accessory", name: "Leather Bag" });
    const result = layoutLook(bag, [], "men", "regular");
    expect(result.layers).toEqual([]);
    expect(result.notShown).toEqual([{ id: bag.id, name: bag.name }]);
  });

  it("uses grey for items with no colour", () => {
    const anchor = { ...item("shirt", { slot: "top" }), display_hex: null, color_hex: null };
    const [layer] = layoutLook(anchor, [], "men", "regular").layers;
    expect(layer.hex).toBe("#9CA3AF");
  });
});
