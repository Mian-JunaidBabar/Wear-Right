/**
 * Decides which items the flat 2D mannequin draws and in which stacking order.
 *
 * Pure functions, no React. The anchor (the product the shopper opened) is always drawn; look
 * picks follow; when two items want the same layer (a second top) the anchor wins and the other
 * item is listed in `notShown`. Colours come straight from the API's `display_hex`, with a grey
 * fallback so an uncoloured product still renders.
 */

import type { ApiItem } from "@/features/recommender/api";
import { geometryFor, type Geometry } from "./geometry";

export type Preset = "slim" | "regular" | "plus";
export type BodyGender = "men" | "women";

export const PRESETS: Preset[] = ["slim", "regular", "plus"];
export const PRESET_LABELS: Record<Preset, string> = {
  slim: "Slim (waist 30-32)",
  regular: "Regular (waist 34-38)",
  plus: "Plus (waist 40+)",
};

/** Waist in inches to a body preset (PRD: slim 30-32, regular 34-38, plus 40 and up). */
export function presetFromWaist(inches: number): Preset {
  if (inches <= 33) return "slim";
  return inches <= 38 ? "regular" : "plus";
}

export type Layer = {
  id: number;
  name: string;
  kind: string;
  slot: string;
  z: number;
  hex: string;
  isAnchor: boolean;
};

export type Layout = { layers: Layer[]; notShown: { id: number; name: string }[] };

/** Kinds with a shape; anything else (bag, unknown) is listed, not drawn. */
export const DRAWABLE_KINDS = new Set([
  "tshirt", "shirt", "polo", "kurta", "kameez", "dress", "jeans", "trousers", "shorts", "shalwar",
  "jacket", "hoodie", "blazer", "waistcoat", "dupatta", "belt", "tie", "sneakers", "formal_shoes",
  "boots", "sandals", "watch", "cap", "sunglasses",
]);

/** Which body layer a kind occupies: kinds within one layer conflict with each other. */
const LAYER_OF_KIND: Record<string, string> = {
  tshirt: "top", shirt: "top", polo: "top",
  jeans: "bottom", trousers: "bottom", shorts: "bottom", shalwar: "bottom",
  sneakers: "footwear", formal_shoes: "footwear", boots: "footwear", sandals: "footwear",
  jacket: "outerwear", hoodie: "outerwear", blazer: "outerwear",
  kurta: "kurta", kameez: "kurta", dress: "dress", dupatta: "dupatta",
  belt: "belt", tie: "tie", watch: "watch", cap: "cap", sunglasses: "sunglasses",
};

/** z order (PRD stack): bottom, top, outerwear, shoes, accessories on top of everything. */
const Z_BY_LAYER: Record<string, number> = {
  bottom: 10, top: 20, belt: 25, outerwear: 30, tie: 32, dupatta: 35, footwear: 40,
  watch: 50, cap: 50, sunglasses: 50, kurta: 20, dress: 20,
};

/** Untagged products fall back to a coarse shape from their slot. */
const FALLBACK_KINDS: Record<string, string> = { top: "shirt", bottom: "trousers", footwear: "sneakers" };
const FALLBACK_LAYERS: Record<string, string> = { top: "top", bottom: "bottom", footwear: "footwear" };

/** An item's kind: what it is, or the accessory read from its name, or the slot fallback. */
export function kindOf(item: Pick<ApiItem, "slot" | "name"> & { kind?: string | null }): string {
  if (item.kind && DRAWABLE_KINDS.has(item.kind)) return item.kind;
  if (item.slot === "accessory") {
    const name = item.name.toLowerCase();
    const accessory = [
      ["tie", "tie"], ["watch", "watch"], ["belt", "belt"], ["cap", "cap"], ["sun", "sunglasses"],
    ].find(([word]) => name.includes(word));
    if (accessory) return accessory[1];
  }
  return item.slot && FALLBACK_KINDS[item.slot] ? FALLBACK_KINDS[item.slot] : "";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- part of the call signature; the renderer uses gender/preset to pick its geometry
export function layoutLook(anchor: ApiItem, picks: ApiItem[], _gender: BodyGender, _preset: Preset): Layout {
  const hexOf = (item: ApiItem): string => item.display_hex || item.color_hex || "#9CA3AF";
  const layers: Layer[] = [];
  const notShown: { id: number; name: string }[] = [];
  const usedLayers = new Set<string>();

  const put = (item: ApiItem, isAnchor: boolean) => {
    const kind = kindOf(item);
    const layer = (kind && LAYER_OF_KIND[kind]) || (item.slot && FALLBACK_LAYERS[item.slot]) || "";
    if (!kind || !layer) {
      notShown.push({ id: item.id, name: item.name });
      return;
    }
    if (usedLayers.has(layer) && !isAnchor) {
      notShown.push({ id: item.id, name: item.name });
      return;
    }
    usedLayers.add(layer);
    layers.push({
      id: item.id, name: item.name, kind, slot: item.slot ?? "",
      z: Z_BY_LAYER[layer] ?? 30, hex: hexOf(item), isAnchor,
    });
  };

  put(anchor, true);
  for (const pick of picks) put(pick, false);

  layers.sort((a, b) => a.z - b.z || +b.isAnchor - +a.isAnchor || a.id - b.id);
  return { layers, notShown };
}

/** Geometry for a renderer; exported so the SVG component and the tests share one source. */
export function geometry(gender: BodyGender, preset: Preset): Geometry {
  return geometryFor(gender, preset);
}
