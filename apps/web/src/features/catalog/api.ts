import { apiGet, apiSend } from "@/lib/api";
import { API_PATHS } from "@/lib/config";

export type ProductsResponse<T> = { status: string; total_products: number; products: T[] };

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
  products: <T = unknown>() => apiGet<ProductsResponse<T>>(API_PATHS.products),
  outfit: <T = unknown>(productId: string | number) => apiGet<T>(API_PATHS.outfitGenerate(productId)),

  categories: (all = false) =>
    apiGet<{ status: string; categories: ApiCategory[] }>(`/api/categories/${all ? "?all=1" : ""}`),
  createCategory: (data: Partial<ApiCategory>) => apiSend("POST", "/api/categories/", data),
  updateCategory: (id: number, data: Partial<ApiCategory>) => apiSend("PUT", `/api/categories/${id}/`, data),
  deleteCategory: (id: number) => apiSend("DELETE", `/api/categories/${id}/`),

  styles: (all = false) => apiGet<{ status: string; styles: ApiStyle[] }>(`/api/styles/${all ? "?all=1" : ""}`),
  createStyle: (data: Partial<ApiStyle>) => apiSend("POST", "/api/styles/", data),
  updateStyle: (id: number, data: Partial<ApiStyle>) => apiSend("PUT", `/api/styles/${id}/`, data),
  deleteStyle: (id: number) => apiSend("DELETE", `/api/styles/${id}/`),
};
