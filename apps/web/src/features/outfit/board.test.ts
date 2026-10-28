import { describe, expect, it } from "vitest";
import type { ApiItem } from "@/features/recommender/api";
import { boardImageFor, buildOutfitBoardTiles, type LookSlotInput } from "./board";

const item = (id: number, over: Partial<ApiItem> = {}): ApiItem => ({
  id,
  name: `Item ${id}`,
  price: 1000 + id,
  image: `/media/products/${id}.jpg`,
  ...over,
});

const slot = (name: string, kind: string, pick: ApiItem | null, required = true): LookSlotInput => ({
  slot: name,
  kind,
  required,
  pick,
});

describe("buildOutfitBoardTiles", () => {
  it("lays a casual look out as top, bottom, shoes and one accessory", () => {
    const anchor = item(1, { name: "Linen shirt", kind: "shirt" });
    const tiles = buildOutfitBoardTiles(
      anchor,
      "top",
      [
        slot("bottom", "", item(2, { kind: "jeans" })),
        slot("footwear", "", item(3, { kind: "sneakers" })),
        slot("accessory", "", item(4, { kind: "watch" }), false),
      ],
    );

    expect(tiles.map((tile) => [tile.area, tile.isAnchor])).toEqual([
      ["top", true],
      ["bottom", false],
      ["footwear", false],
      ["accessory", false],
    ]);
    expect(tiles.find((tile) => tile.area === "top")?.item?.id).toBe(1);
    expect(tiles.find((tile) => tile.area === "bottom")?.item?.id).toBe(2);
    expect(tiles.find((tile) => tile.area === "footwear")?.item?.id).toBe(3);
    expect(tiles.filter((tile) => tile.area === "accessory").map((tile) => tile.item?.id)).toEqual([4]);
  });

  it("draws formal outerwear overlapping the top, with tie and watch in the side column", () => {
    const anchor = item(1, { name: "Shirt", kind: "shirt" });
    const tiles = buildOutfitBoardTiles(
      anchor,
      "top",
      [
        slot("outerwear", "", item(2, { kind: "blazer" })),
        slot("bottom", "", item(3, { kind: "trousers" })),
        slot("footwear", "", item(4, { kind: "formal_shoes" })),
        slot("accessory", "tie", item(5, { kind: "tie" }), false),
        slot("accessory", "watch", item(6, { kind: "watch" }), false),
        slot("accessory", "belt", item(7, { kind: "belt" }), false),
      ],
    );

    const outerwear = tiles.find((tile) => tile.key === "outerwear");
    expect(outerwear?.overlaps).toBe(true);
    expect(outerwear?.item?.id).toBe(2);
    expect(tiles.find((tile) => tile.area === "top" && !tile.overlaps)?.item?.id).toBe(1);
    expect(tiles.filter((tile) => tile.area === "accessory").map((tile) => tile.key)).toEqual(["tie", "watch", "belt"]);
  });

  it("builds an eastern men look as one tall kurta tile, shoes and an overlapping waistcoat, with no bottom tile", () => {
    const anchor = item(1, { name: "Kurta", kind: "kurta" });
    const tiles = buildOutfitBoardTiles(
      anchor,
      "kurta",
      [slot("footwear", "", item(2, { kind: "sandals" })), slot("outerwear", "", item(3, { kind: "waistcoat" }), false)],
    );

    expect(tiles.filter((tile) => tile.area === "bottom")).toEqual([]);
    const tall = tiles.find((tile) => tile.area === "tall");
    expect(tall?.isAnchor).toBe(true);
    expect(tall?.item?.id).toBe(1);
    expect(tiles.find((tile) => tile.area === "footwear")?.item?.id).toBe(2);
    expect(tiles.find((tile) => tile.overlaps)?.item?.id).toBe(3);
  });

  it("builds an eastern women look as tall kurta, its bottom, dupatta and shoes", () => {
    const anchor = item(1, { name: "Kurta", kind: "kurta" });
    const tiles = buildOutfitBoardTiles(
      anchor,
      "kurta",
      [
        slot("bottom", "", item(2, { kind: "shalwar" })),
        slot("dupatta", "", item(3, { kind: "dupatta" }), false),
        slot("footwear", "", item(4, { kind: "sandals" })),
        slot("accessory", "", item(5, { kind: "bag" }), false),
      ],
    );

    expect(tiles.find((tile) => tile.area === "tall")?.item?.id).toBe(1);
    expect(tiles.find((tile) => tile.area === "bottom")?.item?.id).toBe(2);
    expect(tiles.filter((tile) => tile.area === "accessory").map((tile) => tile.item?.id)).toEqual([3, 5]);
    expect(tiles.find((tile) => tile.area === "footwear")?.item?.id).toBe(4);
  });

  it("keeps a slot whose pick is out of stock as a dashed empty tile in its place", () => {
    const anchor = item(1, { kind: "shirt" });
    const tiles = buildOutfitBoardTiles(
      anchor,
      "top",
      [slot("bottom", "", null), slot("footwear", "", item(3, { kind: "sneakers" })), slot("accessory", "", null, false)],
    );

    const bottom = tiles.find((tile) => tile.area === "bottom");
    expect(bottom).toMatchObject({ item: null, skipped: false });
    expect(tiles.find((tile) => tile.key === "accessory")).toMatchObject({ item: null, skipped: false });
  });

  it("uses the shopper's swapped piece and marks an explicitly skipped optional slot", () => {
    const anchor = item(1, { kind: "shirt" });
    const first = item(2, { kind: "jeans" });
    const swapped = item(9, { kind: "trousers" });
    const tiles = buildOutfitBoardTiles(
      anchor,
      "top",
      [slot("bottom", "", first), slot("accessory", "", item(4, { kind: "watch" }), false)],
      { bottom: swapped, accessory: null },
    );

    expect(tiles.find((tile) => tile.area === "bottom")?.item?.id).toBe(9);
    expect(tiles.find((tile) => tile.key === "accessory")).toMatchObject({ item: null, skipped: true });
  });

  it("shows the cut-out only when the product is try-on ready, otherwise the product photo", () => {
    const ready = item(1, { image: "/media/products/1.jpg", mannequin_image: "/media/products/mannequin/1.png", mannequin_ready: true });
    const notReady = item(2, { image: "/media/products/2.jpg", mannequin_image: "/media/products/mannequin/2.png", mannequin_ready: false });

    expect(boardImageFor(ready)).toBe("/media/products/mannequin/1.png");
    expect(boardImageFor(notReady)).toBe("/media/products/2.jpg");
    expect(boardImageFor(item(3))).toBeNull();
  });
});
