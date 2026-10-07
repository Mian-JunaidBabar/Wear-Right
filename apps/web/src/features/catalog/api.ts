import { apiGet } from "@/lib/api";
import { API_PATHS } from "@/lib/config";

export type ProductsResponse<T> = { status: string; total_products: number; products: T[] };

/** Product list and outfit generation. Both are public endpoints. */
export const catalogApi = {
  products: <T = unknown>() => apiGet<ProductsResponse<T>>(API_PATHS.products),
  outfit: <T = unknown>(productId: string | number) => apiGet<T>(API_PATHS.outfitGenerate(productId)),
};
