import type { AlphaItem, AlphaSlot, AlphaWardrobe } from "./api";

/** What the mannequin wears: one product id per slot, or null for the base photo's own clothes. */
export type Outfit = Record<AlphaSlot, number | null>;

export type StackLayer = { key: string; src: string; z: number };

const EMPTY: Outfit = { top: null, bottom: null, shoes: null, watch: null };
const DEFAULT_Z: Record<string, number> = { shoes: 1, bottom: 2, base_bottom: 2, top: 3, base_top: 3, watch: 4 };

export function findItem(wardrobe: AlphaWardrobe, slot: AlphaSlot, productId: number | null): AlphaItem | null {
  if (productId === null) return null;
  const row = wardrobe.slots.find((entry) => entry.slot === slot);
  return row?.items.find((item) => item.product_id === productId) ?? null;
}

export function slotOfProduct(wardrobe: AlphaWardrobe, productId: number): AlphaSlot | null {
  const row = wardrobe.slots.find((entry) => entry.items.some((item) => item.product_id === productId));
  return row ? row.slot : null;
}

export function hasProduct(wardrobe: AlphaWardrobe, productId: number): boolean {
  return wardrobe.base !== null && slotOfProduct(wardrobe, productId) !== null;
}

/** First item of every slot, with `focusProductId` (from ?product=) worn in its slot when it is in the alpha. */
export function defaultOutfit(wardrobe: AlphaWardrobe, focusProductId?: number | null): Outfit {
  const outfit: Outfit = { ...EMPTY };
  for (const row of wardrobe.slots) outfit[row.slot] = row.items[0]?.product_id ?? null;
  if (focusProductId != null) {
    const slot = slotOfProduct(wardrobe, focusProductId);
    if (slot) outfit[slot] = focusProductId;
  }
  return outfit;
}

/** Picking the item already worn takes it off (the base clothes show again). */
export function toggleItem(outfit: Outfit, slot: AlphaSlot, productId: number): Outfit {
  return { ...outfit, [slot]: outfit[slot] === productId ? null : productId };
}

/**
 * The <img> layers to draw over the base photo, lowest first.
 * - A top without a chosen bottom draws the base's trousers (their waist extension fills under a short shirt).
 * - A bottom without a chosen top redraws the base tee, so the bottom's waist extension does not crop it.
 */
export function layerStack(wardrobe: AlphaWardrobe, outfit: Outfit): StackLayer[] {
  const base = wardrobe.base;
  if (!base) return [];
  const z = { ...DEFAULT_Z, ...wardrobe.z_order };
  const layers: StackLayer[] = [];
  (Object.keys(EMPTY) as AlphaSlot[]).forEach((slot) => {
    const item = findItem(wardrobe, slot, outfit[slot]);
    if (item) layers.push({ key: `${slot}-${item.product_id}`, src: item.layer, z: z[slot] });
  });
  const wearsTop = findItem(wardrobe, "top", outfit.top) !== null;
  const wearsBottom = findItem(wardrobe, "bottom", outfit.bottom) !== null;
  if (wearsTop && !wearsBottom && base.base_bottom) layers.push({ key: "base-bottom", src: base.base_bottom, z: z.base_bottom });
  if (wearsBottom && !wearsTop && base.base_top) layers.push({ key: "base-top", src: base.base_top, z: z.base_top });
  return layers.sort((a, b) => a.z - b.z);
}

export function wornItems(wardrobe: AlphaWardrobe, outfit: Outfit): Array<{ slot: AlphaSlot; label: string; item: AlphaItem }> {
  return wardrobe.slots.flatMap((row) => {
    const item = findItem(wardrobe, row.slot, outfit[row.slot]);
    return item ? [{ slot: row.slot, label: row.label, item }] : [];
  });
}

export function outfitTotal(wardrobe: AlphaWardrobe, outfit: Outfit): number {
  return wornItems(wardrobe, outfit).reduce((sum, entry) => sum + Number(entry.item.price || 0), 0);
}

/** A random item in every slot (always something in each slot that has items). */
export function shuffleOutfit(wardrobe: AlphaWardrobe, random: () => number = Math.random): Outfit {
  const outfit: Outfit = { ...EMPTY };
  for (const row of wardrobe.slots) {
    if (!row.items.length) continue;
    outfit[row.slot] = row.items[Math.min(row.items.length - 1, Math.floor(random() * row.items.length))].product_id;
  }
  return outfit;
}

/** Every image the page may show, to preload so swapping is instant. */
export function allImageUrls(wardrobe: AlphaWardrobe): string[] {
  if (!wardrobe.base) return [];
  const { image, base_top, base_bottom } = wardrobe.base;
  const layers = wardrobe.slots.flatMap((row) => row.items.map((item) => item.layer));
  return [image, base_top, base_bottom, ...layers].filter((url): url is string => Boolean(url));
}
