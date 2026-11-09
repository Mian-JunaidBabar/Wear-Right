import { apiGet } from "@/lib/api";

export type PaletteColour = { name: string; hex: string | null };
export type Palette = { best: PaletteColour[]; avoid: PaletteColour[] };

/** A catalog product as the API returns it (only the fields the pages read). */
export type ApiItem = {
  id: number;
  name: string;
  category?: string;
  cultural_tag?: string;
  style_tags?: string[];
  color_name?: string | null;
  color_hex?: string | null;
  slot?: string | null;
  gender?: string | null;
  // What the garment actually is (catalog Product.kind). display_hex is kept from the old
  // mannequin work (plan 02) so the API stays stable for any client that paints with it.
  kind?: string | null;
  display_hex?: string | null;
  // Garment cut-outs from the backend prepare_mannequin_asset pipeline; the outfit board
  // prefers them (transparent flat-lay look) when mannequin_ready is true.
  mannequin_image?: string | null;
  back_image?: string | null;
  mannequin_ready?: boolean;
  mannequin_note?: string;
  price: string | number;
  image?: string | null;
  stock_quantity?: number;
  status?: string;
};

export type PickedItem = ApiItem & { score: number; match: number; reason: string; matched_colour: string };
export type TopPicksResponse = {
  status: string;
  context: { depth: string; undertone: string; gender: string; styles: string[] };
  palette: Palette;
  total_items: number;
  items: PickedItem[];
};

export type LookEntry = ApiItem & { score: number; why: string };
export type LookSlot = { slot: string; kind: string; required: boolean; pick: LookEntry | null; swaps: LookEntry[] };
export type CompleteLookResponse = {
  status: string;
  look_type: "casual" | "formal" | "eastern_men" | "eastern_women";
  gender: string;
  complete: boolean;
  missing: string[];
  anchor: ApiItem;
  // What the anchor actually is and the slot it covers, from catalog Product.kind.
  anchor_kind: string;
  anchor_slot: string;
  slots: LookSlot[];
};

export type PaletteResponse = Palette & { status: string };

export type ShopperParams = {
  depth?: string;
  undertone?: string;
  gender?: string;
  style?: string;
  size?: string;
  /** 1: only colours from the shopper's palette (the "show my colour theme" step after a scan). */
  palette_only?: number;
  /** Only this colour name (a tapped swatch). */
  colour?: string;
};

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** Ranked picks, complete-the-look and tone palettes. All public endpoints. */
export const recommenderApi = {
  topPicks: (params: ShopperParams & { limit?: number } = {}) =>
    apiGet<TopPicksResponse>(`/api/recommendations/top/${query(params)}`),
  completeLook: (productId: string | number, params: ShopperParams = {}) =>
    apiGet<CompleteLookResponse>(`/api/looks/complete/${query({ product_id: productId, ...params })}`),
  palette: (params: ShopperParams) => apiGet<PaletteResponse>(`/api/tone-rules/palette/${query(params)}`),
};
