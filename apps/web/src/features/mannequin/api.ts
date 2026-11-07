import { apiGet } from "@/lib/api";

export type AlphaSlot = "top" | "bottom" | "shoes" | "watch";

export type AlphaItem = {
  product_id: number;
  name: string;
  price: number;
  /** Product photo for the picker (cut-out when there is one). */
  image: string | null;
  /** Transparent garment layer, same size as the base photo. */
  layer: string;
  /** False for products hidden from shoppers (draft/inactive): shown on the mannequin, not linked. */
  available: boolean;
};

export type AlphaBase = {
  image: string;
  /** The base's own tee and trousers as layers; see layerStack for when each is drawn. */
  base_top: string | null;
  base_bottom: string | null;
  width: number;
  height: number;
  label: string;
};

export type AlphaWardrobe = {
  status: string;
  gender: "men" | "women";
  base: AlphaBase | null;
  /** Drawing order from the backend engine: higher is drawn on top. */
  z_order: Record<string, number>;
  slots: Array<{ slot: AlphaSlot; label: string; items: AlphaItem[] }>;
};

/** Mannequin (alpha): the base photo and approved garment layers. Public. */
export const mannequinApi = {
  wardrobe: (gender: "men" | "women" = "men") =>
    apiGet<AlphaWardrobe>(`/api/mannequin/alpha/?gender=${gender}`),
};
