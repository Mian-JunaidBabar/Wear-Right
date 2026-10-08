/**
 * Places garment cut-outs on a 2D mannequin. Pure functions, no React.
 *
 * The anchor map (public/mannequin/anchors.json) gives, for every body (gender, size, angle), the box
 * where each slot's garment goes on an 800 x 1600 canvas. A garment is an <img> that fills its box with
 * object-fit: contain, so its own proportions are kept. Layer order follows the PRD: bottom, top,
 * outerwear, shoes, accessories.
 */
import anchors from "../../../public/mannequin/anchors.json";
import type { ApiItem } from "@/features/recommender/api";

export type Preset = "slim" | "regular" | "plus";
export type Angle = "front" | "back";
export type BodyGender = "men" | "women";

export const PRESETS: Preset[] = ["slim", "regular", "plus"];
export const PRESET_LABELS: Record<Preset, string> = { slim: "Slim (waist 30-32)", regular: "Regular (waist 34-38)", plus: "Plus (waist 40+)" };

type Box = [number, number, number, number];
type Config = {
  canvas: { width: number; height: number };
  z_order: Record<string, number>;
  hidden_in_back: string[];
  bodies: Record<string, { image: string; slots: Record<string, Box> }>;
};
const config = anchors as unknown as Config;

export type Layer = {
  id: number;
  name: string;
  slot: string;
  src: string;
  /** Percentages of the canvas, so the layout scales with the mannequin's size. */
  left: number;
  top: number;
  width: number;
  height: number;
  z: number;
  /** Where a garment sits inside its box: shoes rest on the floor, everything else hangs from the top. */
  align: "top" | "bottom" | "center";
  usesFrontPhoto: boolean;
};
export type Skipped = { id: number; name: string; reason: string };
export type Layout = { body: string; layers: Layer[]; skipped: Skipped[]; notes: string[] };

const ACCESSORY_KINDS: [string, string][] = [["tie", "tie"], ["watch", "watch"], ["belt", "belt"], ["cap", "cap"], ["sunglass", "sunglasses"]];

/** Waist in inches to a body preset (PRD: slim 30-32, regular 34-38, plus 40 and up). */
export function presetFromWaist(inches: number): Preset {
  if (inches <= 33) return "slim";
  return inches <= 38 ? "regular" : "plus";
}

export function bodyFor(gender: BodyGender, preset: Preset, angle: Angle) {
  return config.bodies[`${gender}/${preset}/${angle}`];
}

/** The anchor-map key for a product: its slot, or for accessories the kind read from its name. */
export function anchorKey(item: Pick<ApiItem, "slot" | "name">): string | null {
  if (item.slot !== "accessory") return item.slot ?? null;
  const name = item.name.toLowerCase();
  return ACCESSORY_KINDS.find(([word]) => name.includes(word))?.[1] ?? null;
}

function zFor(key: string): number {
  const order = config.z_order;
  return order[key] ?? order[["tie", "watch", "cap", "sunglasses"].includes(key) ? "accessory" : key] ?? order.accessory;
}

function alignFor(key: string): Layer["align"] {
  if (key === "footwear") return "bottom";
  return ["watch", "cap", "sunglasses", "tie", "belt"].includes(key) ? "center" : "top";
}

export function layoutLook(items: ApiItem[], gender: BodyGender, preset: Preset, angle: Angle): Layout {
  const body = bodyFor(gender, preset, angle);
  const { width, height } = config.canvas;
  const layers: Layer[] = [];
  const skipped: Skipped[] = [];
  const notes: string[] = [];

  for (const item of items) {
    const key = anchorKey(item);
    const box = key ? body.slots[key] : undefined;
    if (!key || !box) {
      skipped.push({ id: item.id, name: item.name, reason: "This kind of item has no place on the mannequin." });
      continue;
    }
    if (angle === "back" && config.hidden_in_back.includes(key)) {
      skipped.push({ id: item.id, name: item.name, reason: "Not visible from the back." });
      continue;
    }
    const backPhoto = angle === "back" ? item.back_image : null;
    const src = backPhoto || item.mannequin_image;
    if (!item.mannequin_ready || !src) {
      skipped.push({
        id: item.id,
        name: item.name,
        reason: item.mannequin_note ? `Photo not usable here: ${item.mannequin_note}.` : "No mannequin photo yet.",
      });
      continue;
    }
    const usesFrontPhoto = angle === "back" && !backPhoto;
    if (usesFrontPhoto) notes.push(`${item.name} has no back photo, so its front is shown.`);
    const [x, y, w, h] = box;
    layers.push({
      id: item.id, name: item.name, slot: key, src,
      left: (x / width) * 100, top: (y / height) * 100, width: (w / width) * 100, height: (h / height) * 100,
      z: zFor(key), align: alignFor(key), usesFrontPhoto,
    });
  }
  layers.sort((a, b) => a.z - b.z || a.id - b.id);
  return { body: body.image, layers, skipped, notes };
}
