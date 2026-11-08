import { apiGet } from "@/lib/api";

export type AlphaSlot = "top" | "kurta" | "outerwear" | "bottom" | "shoes" | "watch" | "eyewear" | "headwear";
export type AlphaSkin = "wheatish" | "fair" | "dark";
export type AlphaGender = "men" | "women";

export type AlphaItem = {
  product_id: number;
  name: string;
  price: number;
  /** Product photo for the picker (cut-out when there is one). */
  image: string | null;
  /** Transparent garment layer (wheatish skin), same size as the base photo. */
  layer: string;
  /** The same layer per skin tone; fair/dark fall back to the wheatish cut on the server. */
  layers?: Partial<Record<AlphaSkin, string>>;
  category?: string;
  color?: string;
  /** Sizes in stock; empty for shoes and accessories, which the cart treats as one size. */
  sizes?: string[];
  stock_quantity?: number;
  status?: string;
  /** False for products hidden from shoppers (draft/inactive): shown on the mannequin, not linked or sold. */
  available: boolean;
  /** Available and in stock: can go in the cart. */
  in_stock?: boolean;
};

export type AlphaBase = {
  image: string;
  /** Base photo per skin tone; null when that tone was not made. */
  skins?: Partial<Record<AlphaSkin, string | null>>;
  /** The base's own tee and trousers as layers; see layerStack for when each is drawn. */
  base_top: string | null;
  base_bottom: string | null;
  width: number;
  height: number;
  label: string;
};

export type AlphaSlotRow = { slot: AlphaSlot; label: string; accessory?: boolean; items: AlphaItem[] };

export type AlphaGroup = { key: "clothes" | "shoes" | "accessories"; label: string; slots: AlphaSlot[] };

export type AlphaWardrobe = {
  status: string;
  gender: AlphaGender;
  base: AlphaBase | null;
  /** Drawing order from the backend engine: higher is drawn on top. */
  z_order: Record<string, number>;
  slots: AlphaSlotRow[];
  /** Picker sections: clothes, shoes, accessories. */
  groups?: AlphaGroup[];
  /** Slots that replace each other (a kurta replaces the shirt). */
  exclusive?: AlphaSlot[][];
};

/** Mannequin (alpha): the base photo and approved garment layers. Public. */
export const mannequinApi = {
  wardrobe: (gender: AlphaGender = "men") =>
    apiGet<AlphaWardrobe>(`/api/mannequin/alpha/?gender=${gender}`),
};
