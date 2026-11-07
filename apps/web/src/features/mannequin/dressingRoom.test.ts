import { describe, expect, it } from "vitest";
import type { AlphaItem, AlphaWardrobe } from "./api";
import {
  allImageUrls,
  defaultOutfit,
  hasProduct,
  layerStack,
  outfitTotal,
  shuffleOutfit,
  toggleItem,
  wornItems,
} from "./dressingRoom";

const item = (id: number, over: Partial<AlphaItem> = {}): AlphaItem => ({
  product_id: id,
  name: `Item ${id}`,
  price: 1000 * id,
  image: `/media/products/${id}.png`,
  layer: `/media/mannequin_alpha/layers/men-${id}.png`,
  available: true,
  ...over,
});

const wardrobe: AlphaWardrobe = {
  status: "success",
  gender: "men",
  base: {
    image: "/media/mannequin_alpha/base/men.jpg",
    base_top: "/media/mannequin_alpha/base/men-top.png",
    base_bottom: "/media/mannequin_alpha/base/men-bottom.png",
    width: 960,
    height: 1280,
    label: "AI-generated model",
  },
  z_order: { shoes: 1, bottom: 2, base_bottom: 2, top: 3, base_top: 3, watch: 4 },
  slots: [
    { slot: "top", label: "Shirts", items: [item(1), item(2)] },
    { slot: "bottom", label: "Trousers", items: [item(3), item(4)] },
    { slot: "shoes", label: "Shoes", items: [item(5)] },
    { slot: "watch", label: "Watches", items: [item(6, { available: false })] },
  ],
};

describe("defaultOutfit", () => {
  it("wears the first item of every slot", () => {
    expect(defaultOutfit(wardrobe)).toEqual({ top: 1, bottom: 3, shoes: 5, watch: 6 });
  });

  it("puts the product from the link in its slot", () => {
    expect(defaultOutfit(wardrobe, 4)).toEqual({ top: 1, bottom: 4, shoes: 5, watch: 6 });
  });

  it("ignores a product that is not in the alpha", () => {
    expect(defaultOutfit(wardrobe, 99)).toEqual(defaultOutfit(wardrobe));
  });
});

describe("layerStack", () => {
  it("draws shoes, then trousers, then the shirt, then the watch", () => {
    const keys = layerStack(wardrobe, { top: 2, bottom: 4, shoes: 5, watch: 6 }).map((layer) => layer.key);
    expect(keys).toEqual(["shoes-5", "bottom-4", "top-2", "watch-6"]);
  });

  it("adds the base trousers under a shirt when no trousers are chosen", () => {
    const keys = layerStack(wardrobe, { top: 1, bottom: null, shoes: null, watch: null }).map((layer) => layer.key);
    expect(keys).toEqual(["base-bottom", "top-1"]);
  });

  it("redraws the base tee over chosen trousers when no shirt is chosen", () => {
    const keys = layerStack(wardrobe, { top: null, bottom: 3, shoes: null, watch: null }).map((layer) => layer.key);
    expect(keys).toEqual(["bottom-3", "base-top"]);
  });

  it("is empty when nothing is imported", () => {
    expect(layerStack({ ...wardrobe, base: null }, defaultOutfit(wardrobe))).toEqual([]);
  });
});

describe("outfit helpers", () => {
  it("toggles an item off when it is picked again", () => {
    const outfit = defaultOutfit(wardrobe);
    expect(toggleItem(outfit, "top", 1).top).toBeNull();
    expect(toggleItem(outfit, "top", 2).top).toBe(2);
  });

  it("lists what is worn and adds up the prices", () => {
    const outfit = { top: 2, bottom: null, shoes: 5, watch: null };
    expect(wornItems(wardrobe, outfit).map((entry) => entry.label)).toEqual(["Shirts", "Shoes"]);
    expect(outfitTotal(wardrobe, outfit)).toBe(7000);
  });

  it("shuffles to a real item in every slot", () => {
    expect(shuffleOutfit(wardrobe, () => 0.99)).toEqual({ top: 2, bottom: 4, shoes: 5, watch: 6 });
  });

  it("knows which products are on the mannequin and what to preload", () => {
    expect(hasProduct(wardrobe, 3)).toBe(true);
    expect(hasProduct(wardrobe, 99)).toBe(false);
    expect(allImageUrls(wardrobe)).toHaveLength(3 + 6);
  });
});
