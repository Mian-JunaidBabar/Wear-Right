import { apiGet, apiSend } from "@/lib/api";
import { API_PATHS } from "@/lib/config";

export type ProductsResponse<T> = {
  status: string;
  total_products: number;
  products: T[];
  count?: number;
  next?: string | null;
  previous?: string | null;
  page?: number;
  page_size?: number;
  total_pages?: number;
  results?: T[];
};

export type ProductQuery = {
  page?: number;
  page_size?: number;
  search?: string;
  category?: string;
  slot?: string;
  gender?: string;
  style?: string;
  color?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  ordering?: string;
};

export type ColourSuggestion = { hex: string; name: string; family: string; palette?: string[] };

const productQuery = (params: ProductQuery = {}) => {
  const query = new URLSearchParams();
  // Existing views render a whole collection at once; page 1 defaults to 12.
  query.set("page_size", String(params.page_size ?? 500));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  return query.toString();
};

export type ApiCategory = {
  id: number;
  name: string;
  gender: "men" | "women" | "unisex";
  /** "Regional" for eastern and regional wear. */
  group: string;
  /** Tile image path; empty means "use a product photo" (`cover`). */
  image: string;
  sort_order: number;
  is_active: boolean;
  /** Active products in stock in this category. */
  product_count: number;
  cover: string | null;
};
export type ApiStyle = { id: number; name: string; slug: string; sort_order: number; is_active: boolean };

/** Product list, outfit generation, and the categories and styles staff can edit. Reads are public. */
export const catalogApi = {
  products: <T = unknown>(params: ProductQuery = {}) =>
    apiGet<ProductsResponse<T>>(`${API_PATHS.products}?${productQuery(params)}`),
  colours: () => apiGet<{ status: string; colors: Array<{ id: number; name: string; hex: string; family: string }> }>("/api/colors/"),
  colourSuggestion: (image: File) => {
    const form = new FormData();
    form.append("image", image);
    return apiSend<{ status: string; suggestion: ColourSuggestion }>("POST", "/api/products/color-suggestion/", form);
  },
  outfit: <T = unknown>(productId: string | number) => apiGet<T>(API_PATHS.outfitGenerate(productId)),

  categories: (all = false) =>
    apiGet<{ status: string; categories: ApiCategory[] }>(`/api/categories/${all ? "?all=1" : ""}`),
  createCategory: (data: Partial<ApiCategory>) => apiSend("POST", "/api/categories/", data),
  updateCategory: (id: number, data: Partial<ApiCategory>) => apiSend("PUT", `/api/categories/${id}/`, data),
  deleteCategory: (id: number) => apiSend("DELETE", `/api/categories/${id}/`),

  getStyles: (all = false) => apiGet<{ status: string; styles: ApiStyle[] }>(`/api/styles/${all ? "?all=1" : ""}`),
  createStyle: (data: Partial<ApiStyle>) => apiSend("POST", "/api/styles/", data),
  updateStyle: (id: number, data: Partial<ApiStyle>) => apiSend("PUT", `/api/styles/${id}/`, data),
  deleteStyle: (id: number) => apiSend("DELETE", `/api/styles/${id}/`),
};
