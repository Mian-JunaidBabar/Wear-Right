import { describe, expect, it } from "vitest";
import type { ApiItem } from "@/features/recommender/api";
import { anchorKey, bodyFor, layoutLook, presetFromWaist, PRESETS } from "./layout";

let nextId = 1;
const garment = (slot: string, extra: Partial<ApiItem> = {}): ApiItem => ({
  id: nextId++, name: `${slot} ${nextId}`, slot, price: 1000, mannequin_image: `/media/${slot}.png`, mannequin_ready: true, ...extra,
});

describe("presetFromWaist", () => {
  it.each([[30, "slim"], [32, "slim"], [33, "slim"], [34, "regular"], [38, "regular"], [39, "plus"], [44, "plus"]])("%i inches is %s", (inches, preset) => {
    expect(presetFromWaist(inches)).toBe(preset);
  });
});

describe("the anchor map", () => {
  it("has a body for every gender, size and angle, with a box for every slot", () => {
    for (const gender of ["men", "women"] as const)
      for (const preset of PRESETS)
        for (const angle of ["front", "back"] as const) {
          const body = bodyFor(gender, preset, angle);
          expect(body.image).toBe(`/mannequin/${gender}-${preset}-${angle}.png`);
          for (const slot of ["top", "bottom", "outerwear", "kurta", "dupatta", "footwear", "belt", "watch", "tie", "cap", "sunglasses"]) {
            const [x, y, w, h] = body.slots[slot];
            expect(x).toBeGreaterThanOrEqual(0);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(x + w).toBeLessThanOrEqual(800);
            expect(y + h).toBeLessThanOrEqual(1600);
          }
        }
  });

  it("makes the slot boxes wider for a larger size", () => {
    const widthOf = (preset: "slim" | "regular" | "plus") => bodyFor("men", preset, "front").slots.top[2];
    expect(widthOf("slim")).toBeLessThan(widthOf("regular"));
    expect(widthOf("regular")).toBeLessThan(widthOf("plus"));
  });
});

describe("anchorKey", () => {
  it("uses the slot, and the kind in the name for accessories", () => {
    expect(anchorKey({ slot: "top", name: "Shirt" })).toBe("top");
    expect(anchorKey({ slot: "accessory", name: "Fastrack Black Watch" })).toBe("watch");
    expect(anchorKey({ slot: "accessory", name: "Silk Tie" })).toBe("tie");
    expect(anchorKey({ slot: "accessory", name: "Aviator Sunglasses" })).toBe("sunglasses");
    expect(anchorKey({ slot: "accessory", name: "Mystery thing" })).toBeNull();
    expect(anchorKey({ slot: null, name: "Untagged" })).toBeNull();
  });
});

describe("layoutLook", () => {
  it("stacks layers bottom, top, outerwear, shoes, accessories", () => {
    const look = [garment("footwear"), garment("outerwear"), garment("top"), garment("bottom"), garment("accessory", { name: "Black Watch" })];
    const { layers } = layoutLook(look, "men", "regular", "front");
    expect(layers.map((l) => l.slot)).toEqual(["bottom", "top", "outerwear", "footwear", "watch"]);
  });

  it("puts each garment in its slot's box as percentages of the canvas", () => {
    const top = garment("top");
    const [layer] = layoutLook([top], "women", "plus", "front").layers;
    const [x, y, w, h] = bodyFor("women", "plus", "front").slots.top;
    expect([layer.left, layer.top, layer.width, layer.height]).toEqual([(x / 800) * 100, (y / 1600) * 100, (w / 800) * 100, (h / 1600) * 100]);
  });

  it("rests shoes on the floor and hangs clothes from the top of their box", () => {
    const { layers } = layoutLook([garment("footwear"), garment("top")], "men", "regular", "front");
    expect(Object.fromEntries(layers.map((l) => [l.slot, l.align]))).toEqual({ top: "top", footwear: "bottom" });
  });

  it("swaps the body and the boxes when the size changes", () => {
    const top = garment("top");
    const slim = layoutLook([top], "men", "slim", "front");
    const plus = layoutLook([top], "men", "plus", "front");
    expect(slim.body).toBe("/mannequin/men-slim-front.png");
    expect(plus.body).toBe("/mannequin/men-plus-front.png");
    expect(plus.layers[0].width).toBeGreaterThan(slim.layers[0].width);
  });

  it("does not place a photo that shows a person, and says why", () => {
    const model = garment("top", { mannequin_ready: false, mannequin_note: "a person is in the photo" });
    const result = layoutLook([model], "men", "regular", "front");
    expect(result.layers).toEqual([]);
    expect(result.skipped[0].reason).toContain("a person is in the photo");
  });

  it("skips items with no mannequin photo, no slot, or an unknown accessory", () => {
    const result = layoutLook(
      [garment("top", { mannequin_image: null }), garment("accessory", { name: "Mystery" }), { id: 99, name: "x", slot: null, price: 1 }],
      "men", "regular", "front",
    );
    expect(result.layers).toEqual([]);
    expect(result.skipped).toHaveLength(3);
  });

  it("uses the back photo in the back view when there is one", () => {
    const shirt = garment("top", { back_image: "/media/back.png" });
    const [layer] = layoutLook([shirt], "men", "regular", "back").layers;
    expect(layer.src).toBe("/media/back.png");
    expect(layer.usesFrontPhoto).toBe(false);
  });

  it("falls back to the front photo in the back view and says so", () => {
    const shirt = garment("top", { name: "Linen Shirt" });
    const result = layoutLook([shirt], "men", "regular", "back");
    expect(result.layers[0].src).toBe("/media/top.png");
    expect(result.layers[0].usesFrontPhoto).toBe(true);
    expect(result.notes).toEqual(["Linen Shirt has no back photo, so its front is shown."]);
    expect(layoutLook([shirt], "men", "regular", "front").notes).toEqual([]);
  });

  it("hides ties and sunglasses from the back", () => {
    const result = layoutLook([garment("accessory", { name: "Silk Tie" }), garment("accessory", { name: "Sunglasses" })], "men", "regular", "back");
    expect(result.layers).toEqual([]);
    expect(result.skipped.map((s) => s.reason)).toEqual(["Not visible from the back.", "Not visible from the back."]);
  });
});
