import { describe, expect, it } from "vitest";
import type { AlphaItem, AlphaWardrobe } from "./api";
import {
  allImageUrls,
  availableSkins,
  baseImage,
  buyableItems,
  defaultOutfit,
  defaultSize,
  emptyOutfit,
  hasProduct,
  layerStack,
  outfitTotal,
  pickerGroups,
  shuffleOutfit,
  skinFromContrast,
  toggleItem,
  wornItems,
} from "./dressingRoom";

const layer = (id: number, skin = "") => `/media/mannequin_alpha/layers/men-${id}${skin ? `-${skin}` : ""}.png`;

const item = (id: number, over: Partial<AlphaItem> = {}): AlphaItem => ({
  product_id: id,
  name: `Item ${id}`,
  price: 1000 * id,
  image: `/media/products/${id}.png`,
  layer: layer(id),
  layers: { wheatish: layer(id), fair: layer(id, "fair"), dark: layer(id, "dark") },
  sizes: ["S", "M", "L"],
  available: true,
  in_stock: true,
  ...over,
});

const wardrobe: AlphaWardrobe = {
  status: "success",
  gender: "men",
  base: {
    image: "/media/mannequin_alpha/base/men.jpg",
    skins: { wheatish: "/media/mannequin_alpha/base/men.jpg", fair: "/media/mannequin_alpha/base/men-fair.jpg", dark: null },
    base_top: "/media/mannequin_alpha/base/men-top.png",
    base_bottom: "/media/mannequin_alpha/base/men-bottom.png",
    width: 960,
    height: 1280,
    label: "AI-generated model",
  },
  z_order: { shoes: 1, bottom: 2, base_bottom: 2, top: 3, kurta: 3, base_top: 3, outerwear: 4, watch: 5, eyewear: 6, headwear: 7 },
  slots: [
    { slot: "top", label: "Shirts & tops", items: [item(1), item(2)] },
    { slot: "kurta", label: "Kurtas", items: [item(11)] },
    { slot: "outerwear", label: "Blazers & waistcoats", items: [item(12)] },
    { slot: "bottom", label: "Trousers & shalwar", items: [item(3), item(4)] },
    { slot: "shoes", label: "Shoes", items: [item(5, { sizes: [] })] },
    { slot: "watch", label: "Watches", accessory: true, items: [item(6, { available: false, sizes: [] })] },
    { slot: "eyewear", label: "Sunglasses", accessory: true, items: [item(7, { sizes: [] })] },
    { slot: "headwear", label: "Caps", accessory: true, items: [item(8, { sizes: [], in_stock: false })] },
  ],
  exclusive: [["top", "kurta"]],
};

const outfit = (over: Partial<ReturnType<typeof emptyOutfit>>) => ({ ...emptyOutfit(), ...over });

describe("defaultOutfit", () => {
  it("wears a shirt, trousers and shoes, no extras", () => {
    expect(defaultOutfit(wardrobe)).toEqual(outfit({ top: 1, bottom: 3, shoes: 5 }));
  });

  it("puts the product from the link in its slot, and a kurta replaces the shirt", () => {
    expect(defaultOutfit(wardrobe, 4)).toEqual(outfit({ top: 1, bottom: 4, shoes: 5 }));
    expect(defaultOutfit(wardrobe, 11)).toEqual(outfit({ kurta: 11, bottom: 3, shoes: 5 }));
    expect(defaultOutfit(wardrobe, 7)).toEqual(outfit({ top: 1, bottom: 3, shoes: 5, eyewear: 7 }));
  });

  it("ignores a product that is not on the mannequin", () => {
    expect(defaultOutfit(wardrobe, 99)).toEqual(defaultOutfit(wardrobe));
  });
});

describe("toggleItem", () => {
  it("a kurta takes the shirt off and a shirt takes the kurta off", () => {
    const withKurta = toggleItem(wardrobe, outfit({ top: 1, bottom: 3 }), "kurta", 11);
    expect(withKurta).toEqual(outfit({ kurta: 11, bottom: 3 }));
    expect(toggleItem(wardrobe, withKurta, "top", 2)).toEqual(outfit({ top: 2, bottom: 3 }));
  });

  it("accessories are worn together", () => {
    let look = outfit({ top: 1 });
    look = toggleItem(wardrobe, look, "watch", 6);
    look = toggleItem(wardrobe, look, "eyewear", 7);
    look = toggleItem(wardrobe, look, "headwear", 8);
    expect(look).toEqual(outfit({ top: 1, watch: 6, eyewear: 7, headwear: 8 }));
  });

  it("picking the worn item takes it off", () => {
    expect(toggleItem(wardrobe, outfit({ eyewear: 7 }), "eyewear", 7)).toEqual(emptyOutfit());
  });
});

describe("layerStack", () => {
  it("draws shoes, trousers, shirt, blazer, then watch, sunglasses and cap", () => {
    const look = outfit({ top: 2, outerwear: 12, bottom: 4, shoes: 5, watch: 6, eyewear: 7, headwear: 8 });
    expect(layerStack(wardrobe, look).map((entry) => entry.key)).toEqual([
      "shoes-5-wheatish", "bottom-4-wheatish", "top-2-wheatish", "outerwear-12-wheatish",
      "watch-6-wheatish", "eyewear-7-wheatish", "headwear-8-wheatish",
    ]);
  });

  it("uses the layer for the chosen skin", () => {
    expect(layerStack(wardrobe, outfit({ eyewear: 7 }), "fair")[0].src).toBe(layer(7, "fair"));
    const plain = { ...wardrobe, slots: [{ slot: "eyewear" as const, label: "Sunglasses", items: [item(7, { layers: undefined })] }] };
    expect(layerStack(plain, outfit({ eyewear: 7 }), "dark")[0].src).toBe(layer(7));
  });

  it("adds the base trousers under a shirt, and the base tee over a bottom with no shirt or kurta", () => {
    expect(layerStack(wardrobe, outfit({ top: 1 })).map((entry) => entry.key)).toEqual(["base-bottom", "top-1-wheatish"]);
    expect(layerStack(wardrobe, outfit({ bottom: 3 })).map((entry) => entry.key)).toEqual(["bottom-3-wheatish", "base-top"]);
    expect(layerStack(wardrobe, outfit({ kurta: 11, bottom: 3 })).map((entry) => entry.key)).toEqual([
      "bottom-3-wheatish", "kurta-11-wheatish",
    ]);
  });

  it("is empty without a base", () => {
    expect(layerStack({ ...wardrobe, base: null }, outfit({ top: 1 }))).toEqual([]);
  });
});

describe("skins", () => {
  it("offers the tones that have a base photo", () => {
    expect(availableSkins(wardrobe)).toEqual(["fair", "wheatish"]);
    expect(baseImage(wardrobe, "fair")).toBe("/media/mannequin_alpha/base/men-fair.jpg");
    expect(baseImage(wardrobe, "dark")).toBe("/media/mannequin_alpha/base/men.jpg");
  });

  it("maps the scan's Fair / Medium / Dark to a mannequin skin", () => {
    expect(skinFromContrast("Fair")).toBe("fair");
    expect(skinFromContrast("Medium")).toBe("wheatish");
    expect(skinFromContrast("Dark")).toBe("dark");
    expect(skinFromContrast(undefined)).toBe("wheatish");
  });
});

describe("cart helpers", () => {
  it("only offers available, in-stock items", () => {
    const look = outfit({ top: 1, shoes: 5, watch: 6, headwear: 8 });
    expect(buyableItems(wardrobe, look).map((entry) => entry.item.product_id)).toEqual([1, 5]);
  });

  it("picks M when offered, the first size otherwise, and none for one-size items", () => {
    expect(defaultSize(item(1))).toBe("M");
    expect(defaultSize(item(1, { sizes: ["L", "XL"] }))).toBe("L");
    expect(defaultSize(item(5, { sizes: [] }))).toBeUndefined();
  });
});

describe("helpers", () => {
  it("lists worn items in slot order and totals the price", () => {
    const look = outfit({ top: 2, bottom: 3, eyewear: 7 });
    expect(wornItems(wardrobe, look).map((entry) => entry.slot)).toEqual(["top", "bottom", "eyewear"]);
    expect(outfitTotal(wardrobe, look)).toBe(2000 + 3000 + 7000);
  });

  it("groups the picker into clothes, shoes and accessories", () => {
    expect(pickerGroups(wardrobe).map((group) => [group.key, group.rows.map((row) => row.slot)])).toEqual([
      ["clothes", ["top", "kurta", "outerwear", "bottom"]],
      ["shoes", ["shoes"]],
      ["accessories", ["watch", "eyewear", "headwear"]],
    ]);
  });

  it("shuffle wears a shirt or a kurta, never both", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      let state = seed / 20;
      const look = shuffleOutfit(wardrobe, () => {
        state = (state * 9301 + 0.49297) % 1;
        return state;
      });
      expect(look.top === null || look.kurta === null).toBe(true);
      expect(look.bottom).not.toBeNull();
    }
  });

  it("knows which products are on the mannequin and preloads the skin's images", () => {
    expect(hasProduct(wardrobe, 11)).toBe(true);
    expect(hasProduct(wardrobe, 99)).toBe(false);
    const urls = allImageUrls(wardrobe, "fair");
    expect(urls[0]).toBe("/media/mannequin_alpha/base/men-fair.jpg");
    expect(urls).toContain(layer(7, "fair"));
  });
});
