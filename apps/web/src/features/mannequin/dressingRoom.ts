import type { AlphaGroup, AlphaItem, AlphaSkin, AlphaSlot, AlphaWardrobe } from "./api";

/**
 * What the mannequin wears: one product id per slot, or null for nothing / the base photo's own clothes.
 * Each accessory (watch, sunglasses, cap) is its own slot, so any mix of them can be worn together.
 */
export type Outfit = Record<AlphaSlot, number | null>;

export type StackLayer = { key: string; src: string; z: number };

export const SLOT_ORDER: AlphaSlot[] = ["top", "kurta", "outerwear", "bottom", "shoes", "watch", "eyewear", "headwear"];
export const ACCESSORY_SLOTS: AlphaSlot[] = ["watch", "eyewear", "headwear"];
/** Worn by default (and by shuffle); outerwear and accessories are extras the shopper adds. */
const BASIC_SLOTS: AlphaSlot[] = ["top", "bottom", "shoes"];
const DEFAULT_EXCLUSIVE: AlphaSlot[][] = [["top", "kurta"]];
const DEFAULT_Z: Record<string, number> = {
  shoes: 1, bottom: 2, base_bottom: 2, top: 3, kurta: 3, base_top: 3, outerwear: 4, watch: 5, eyewear: 6, headwear: 7,
};
const DEFAULT_GROUPS: Array<Omit<AlphaGroup, "slots"> & { slots: AlphaSlot[] }> = [
  { key: "clothes", label: "Clothes", slots: ["top", "kurta", "outerwear", "bottom"] },
  { key: "shoes", label: "Shoes", slots: ["shoes"] },
  { key: "accessories", label: "Accessories", slots: ACCESSORY_SLOTS },
];

export function emptyOutfit(): Outfit {
  return { top: null, kurta: null, outerwear: null, bottom: null, shoes: null, watch: null, eyewear: null, headwear: null };
}

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

/** Slots that cannot be worn together with `slot` (a kurta and a shirt). */
export function rivalsOf(wardrobe: AlphaWardrobe, slot: AlphaSlot): AlphaSlot[] {
  const groups = wardrobe.exclusive ?? DEFAULT_EXCLUSIVE;
  return groups.filter((group) => group.includes(slot)).flat().filter((other) => other !== slot);
}

/** Put an item on, taking off whatever it replaces. */
export function wear(wardrobe: AlphaWardrobe, outfit: Outfit, slot: AlphaSlot, productId: number): Outfit {
  const next: Outfit = { ...outfit, [slot]: productId };
  for (const rival of rivalsOf(wardrobe, slot)) next[rival] = null;
  return next;
}

/** Picking the item already worn takes it off; anything else is put on (see `wear`). */
export function toggleItem(wardrobe: AlphaWardrobe, outfit: Outfit, slot: AlphaSlot, productId: number): Outfit {
  if (outfit[slot] === productId) return { ...outfit, [slot]: null };
  return wear(wardrobe, outfit, slot, productId);
}

/** A shirt, trousers and shoes (first of each), with `focusProductId` (from ?product=) worn in its slot. */
export function defaultOutfit(wardrobe: AlphaWardrobe, focusProductId?: number | null): Outfit {
  let outfit = emptyOutfit();
  for (const row of wardrobe.slots) {
    if (BASIC_SLOTS.includes(row.slot)) outfit[row.slot] = row.items[0]?.product_id ?? null;
  }
  if (outfit.top === null) {
    const kurtas = wardrobe.slots.find((row) => row.slot === "kurta");
    outfit.kurta = kurtas?.items[0]?.product_id ?? null;
  }
  if (focusProductId != null) {
    const slot = slotOfProduct(wardrobe, focusProductId);
    if (slot) outfit = wear(wardrobe, outfit, slot, focusProductId);
  }
  return outfit;
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

/**
 * A random look: a shirt or a kurta, a bottom and shoes; a blazer/waistcoat and each accessory half the time.
 */
export function shuffleOutfit(wardrobe: AlphaWardrobe, random: () => number = Math.random): Outfit {
  const outfit = emptyOutfit();
  const items = (slot: AlphaSlot) => wardrobe.slots.find((row) => row.slot === slot)?.items ?? [];
  const uppers = [
    ...items("top").map((item) => ({ slot: "top" as AlphaSlot, item })),
    ...items("kurta").map((item) => ({ slot: "kurta" as AlphaSlot, item })),
  ];
  if (uppers.length) {
    const chosen = pick(uppers, random);
    outfit[chosen.slot] = chosen.item.product_id;
  }
  for (const slot of ["bottom", "shoes"] as AlphaSlot[]) {
    if (items(slot).length) outfit[slot] = pick(items(slot), random).product_id;
  }
  for (const slot of ["outerwear", ...ACCESSORY_SLOTS] as AlphaSlot[]) {
    if (items(slot).length && random() < 0.5) outfit[slot] = pick(items(slot), random).product_id;
  }
  return outfit;
}

/** Skin tones this wardrobe has a base photo for (wheatish always). */
export function availableSkins(wardrobe: AlphaWardrobe): AlphaSkin[] {
  const skins = wardrobe.base?.skins ?? {};
  return (["fair", "wheatish", "dark"] as AlphaSkin[]).filter((skin) => skin === "wheatish" || Boolean(skins[skin]));
}

/** The user's saved tone (Fair / Medium / Dark from the face scan) as a mannequin skin. */
export function skinFromContrast(contrastType?: string | null): AlphaSkin {
  const value = (contrastType || "").toLowerCase();
  if (value === "fair") return "fair";
  if (value === "dark") return "dark";
  return "wheatish";
}

export function baseImage(wardrobe: AlphaWardrobe, skin: AlphaSkin): string | null {
  const base = wardrobe.base;
  if (!base) return null;
  return base.skins?.[skin] || base.image;
}

function layerFor(item: AlphaItem, skin: AlphaSkin): string {
  return item.layers?.[skin] || item.layer;
}

/**
 * The <img> layers to draw over the base photo, lowest first.
 * - A shirt without a chosen bottom draws the base's trousers (their waist extension fills under a short shirt).
 * - A bottom without a shirt or kurta redraws the base tee, so the bottom's waist extension does not crop it.
 */
export function layerStack(wardrobe: AlphaWardrobe, outfit: Outfit, skin: AlphaSkin = "wheatish"): StackLayer[] {
  const base = wardrobe.base;
  if (!base) return [];
  const z = { ...DEFAULT_Z, ...wardrobe.z_order };
  const layers: StackLayer[] = [];
  for (const slot of SLOT_ORDER) {
    const item = findItem(wardrobe, slot, outfit[slot]);
    if (item) layers.push({ key: `${slot}-${item.product_id}-${skin}`, src: layerFor(item, skin), z: z[slot] ?? 3 });
  }
  const wears = (slot: AlphaSlot) => findItem(wardrobe, slot, outfit[slot]) !== null;
  if (wears("top") && !wears("bottom") && base.base_bottom) {
    layers.push({ key: "base-bottom", src: base.base_bottom, z: z.base_bottom });
  }
  if (wears("bottom") && !wears("top") && !wears("kurta") && base.base_top) {
    layers.push({ key: "base-top", src: base.base_top, z: z.base_top });
  }
  return layers.sort((a, b) => a.z - b.z);
}

export type WornItem = { slot: AlphaSlot; label: string; item: AlphaItem };

export function wornItems(wardrobe: AlphaWardrobe, outfit: Outfit): WornItem[] {
  const rows = [...wardrobe.slots].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  return rows.flatMap((row) => {
    const item = findItem(wardrobe, row.slot, outfit[row.slot]);
    return item ? [{ slot: row.slot, label: row.label, item }] : [];
  });
}

export function outfitTotal(wardrobe: AlphaWardrobe, outfit: Outfit): number {
  return wornItems(wardrobe, outfit).reduce((sum, entry) => sum + Number(entry.item.price || 0), 0);
}

export function canBuy(item: AlphaItem): boolean {
  return item.available && item.in_stock !== false;
}

/** Worn items that can go in the cart. */
export function buyableItems(wardrobe: AlphaWardrobe, outfit: Outfit): WornItem[] {
  return wornItems(wardrobe, outfit).filter((entry) => canBuy(entry.item));
}

/** The size to put in the cart when the shopper has not picked one: M when offered, else the first size.
 * Undefined for shoes and accessories without sizes (the cart treats them as one size). */
export function defaultSize(item: AlphaItem): string | undefined {
  const sizes = item.sizes ?? [];
  if (!sizes.length) return undefined;
  return sizes.includes("M") ? "M" : sizes[0];
}

/** Picker sections in display order, each with the slot rows that have items. */
export function pickerGroups(wardrobe: AlphaWardrobe): Array<{ key: string; label: string; rows: AlphaWardrobe["slots"] }> {
  const groups = wardrobe.groups?.length ? wardrobe.groups : DEFAULT_GROUPS;
  return groups
    .map((group) => ({
      key: group.key,
      label: group.label,
      rows: group.slots
        .map((slot) => wardrobe.slots.find((row) => row.slot === slot))
        .filter((row): row is AlphaWardrobe["slots"][number] => Boolean(row && row.items.length)),
    }))
    .filter((group) => group.rows.length > 0);
}

/** Every image the page may show for a skin, to preload so swapping is instant. */
export function allImageUrls(wardrobe: AlphaWardrobe, skin: AlphaSkin = "wheatish"): string[] {
  if (!wardrobe.base) return [];
  const { base_top, base_bottom } = wardrobe.base;
  const layers = wardrobe.slots.flatMap((row) => row.items.map((item) => layerFor(item, skin)));
  return [baseImage(wardrobe, skin), base_top, base_bottom, ...layers].filter((url): url is string => Boolean(url));
}
