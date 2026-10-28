import type { ApiItem } from "@/features/recommender/api";

/**
 * The outfit board's tile model: where each piece of a complete-look response sits.
 *
 * Pure TypeScript (no React) so the placement rules are tested without rendering, the same
 * way the old mannequin layout engine was. The board shows the products' own photos arranged
 * the way a person wears them — top over bottom over shoes, accessories alongside.
 */

/** Human slot names, shared by the board and the list rows. */
export const SLOT_LABELS: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  footwear: "Shoes",
  outerwear: "Jacket / blazer",
  kurta: "Kurta",
  dupatta: "Dupatta",
  accessory: "Accessory",
  tie: "Tie",
  watch: "Watch",
  belt: "Belt",
};

export type BoardArea = "tall" | "top" | "bottom" | "footwear" | "accessory";

export type BoardTile = {
  /** "anchor" or the look slot's key (kind || slot) — the same key the list rows use. */
  key: string;
  /** Label shown under the tile ("Top", "Tie"...). */
  label: string;
  area: BoardArea;
  /** The piece shown in the tile; null draws the dashed empty tile. */
  item: ApiItem | null;
  isAnchor: boolean;
  /** An optional slot the shopper chose to skip (still an empty tile, but not "out of stock"). */
  skipped: boolean;
  /** Outerwear: drawn slightly overlapping the top tile instead of in its own row. */
  overlaps: boolean;
};

export type LookSlotInput = {
  slot: string;
  kind: string;
  required: boolean;
  pick: ApiItem | null;
  swaps?: ApiItem[];
};

const keyOf = (slot: { slot: string; kind: string }) => slot.kind || slot.slot;

const labelFor = (slot: string, kind: string) =>
  SLOT_LABELS[kind || slot] ?? SLOT_LABELS[slot] ?? slot;

/**
 * Lays a complete-look response out for the board.
 *
 * - A kurta/dress anchor or slot becomes one tall tile spanning the top and bottom rows; a
 *   bottom piece, when the look has one, keeps its own tile in wear order below it.
 * - Outerwear is drawn as a second, slightly overlapping tile to the left of the top.
 * - Dupattas, ties, watches, belts and generic accessories stack in the side column.
 * - Slots with no piece keep their place as dashed empty tiles, so the board never quietly
 *   pretends a slot does not exist.
 */
export function buildOutfitBoardTiles(
  anchor: ApiItem,
  anchorSlot: string,
  slots: LookSlotInput[],
  chosen: Record<string, ApiItem | null> = {},
): BoardTile[] {
  const byKey = new Map(slots.map((slot) => [keyOf(slot), slot]));

  const tile = (key: string, area: BoardArea, fallbackLabel?: string): BoardTile => {
    if (key === "anchor") {
      return {
        key,
        label: fallbackLabel ?? labelFor(anchorSlot, anchor.kind || ""),
        area,
        item: anchor,
        isAnchor: true,
        skipped: false,
        overlaps: false,
      };
    }
    const slot = byKey.get(key);
    if (!slot) {
      return { key, label: fallbackLabel ?? labelFor(key.split("-")[0], key), area, item: null, isAnchor: false, skipped: false, overlaps: false };
    }
    const current = key in chosen ? chosen[key] : slot.pick;
    return {
      key,
      label: fallbackLabel ?? labelFor(slot.slot, slot.kind),
      area,
      item: current ?? null,
      isAnchor: false,
      // "Not included" is only for a piece the shopper dropped themselves; a slot whose
      // pick is simply out of stock stays "No match in stock" so the gap stays honest.
      skipped: key in chosen && chosen[key] === null,
      overlaps: false,
    };
  };

  const tiles: BoardTile[] = [];

  // The one-piece slot: the anchor kurta/dress or the look's kurta slot.
  const hasTall = anchorSlot === "kurta" || byKey.has("kurta");
  if (hasTall) {
    tiles.push(tile(anchorSlot === "kurta" ? "anchor" : "kurta", "tall", SLOT_LABELS.kurta));
  } else {
    tiles.push(tile(anchorSlot === "top" ? "anchor" : "top", "top"));
  }

  // Outerwear overlaps the top; it is optional in eastern looks (the waistcoat).
  if (anchorSlot === "outerwear" || byKey.has("outerwear")) {
    const outerwear = tile(anchorSlot === "outerwear" ? "anchor" : "outerwear", "top");
    tiles.push({ ...outerwear, overlaps: true });
  }

  // The bottom: only when the look has one (a kurta on its own leaves no bottom tile).
  const bottomSlot = anchorSlot === "bottom" || byKey.has("bottom");
  if (!hasTall || bottomSlot) {
    tiles.push(tile(anchorSlot === "bottom" ? "anchor" : "bottom", "bottom"));
  }

  tiles.push(tile(anchorSlot === "footwear" ? "anchor" : "footwear", "footwear"));

  // Accessories and the dupatta stack in the side column, in template order. An accessory
  // anchor fills its own tile first, then the look's remaining accessory slots follow.
  const accessorySlots = slots.filter((slot) => slot.slot === "dupatta" || slot.slot === "accessory");
  const anchorIsAccessory = anchorSlot === "dupatta" || anchorSlot === "accessory";
  if (anchorIsAccessory) {
    const kind = anchor.kind || "";
    tiles.push({
      key: "anchor",
      label: SLOT_LABELS[kind] ?? SLOT_LABELS[anchorSlot] ?? "Accessory",
      area: "accessory",
      item: anchor,
      isAnchor: true,
      skipped: false,
      overlaps: false,
    });
  }
  for (const slot of accessorySlots) {
    const key = keyOf(slot);
    if (anchorIsAccessory && anchor.kind && slot.kind === anchor.kind) continue;
    tiles.push(tile(key, "accessory"));
  }

  return tiles;
}

/** The image a tile shows: the cut-out when it is try-on ready, otherwise the product photo. */
export function boardImageFor(item: ApiItem): string | null {
  if (item.mannequin_image && item.mannequin_ready) return item.mannequin_image;
  return item.image || null;
}

export const formatBoardPrice = (price: string | number) => `Rs. ${Number(price || 0).toLocaleString("en-PK")}`;
