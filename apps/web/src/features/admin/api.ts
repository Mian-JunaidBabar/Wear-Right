import { apiGet, apiSend } from "@/lib/api";
import { API_PATHS } from "@/lib/config";

/**
 * Staff-only calls for the admin panel. Django answers 401/403 to anyone else,
 * so hiding the page in the UI is a convenience, not the protection.
 */
export const adminApi = {
  dashboard: <T = unknown>() => apiGet<T>(API_PATHS.adminDashboard),
  products: <T = unknown>() => apiGet<T>(API_PATHS.products),
  orders: <T = unknown>() => apiGet<T>(API_PATHS.orders),
  bookings: <T = unknown>() => apiGet<T>(API_PATHS.bookings),
  faceScans: <T = unknown>() => apiGet<T>(API_PATHS.faceScans),

  /** Creates (no id) or updates (id) a product. `formData` carries the optional image file. */
  saveProduct: (id: number | null, formData: FormData) =>
    id === null
      ? apiSend("POST", API_PATHS.products, formData)
      : apiSend("PUT", `${API_PATHS.products}${id}/`, formData),
  deleteProduct: (id: number) => apiSend("DELETE", `${API_PATHS.products}${id}/`),

  updateBooking: (id: number, patch: { status: string }) =>
    apiSend("PUT", `${API_PATHS.bookings}${id}/`, patch),
  deleteBooking: (id: number) => apiSend("DELETE", `${API_PATHS.bookings}${id}/`),

  updateOrder: (id: number, patch: { order_status: string }) =>
    apiSend("PUT", `${API_PATHS.orders}${id}/`, patch),
  deleteOrder: (id: number) => apiSend("DELETE", `${API_PATHS.orders}${id}/`),
};
