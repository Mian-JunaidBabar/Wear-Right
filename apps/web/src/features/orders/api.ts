import { apiGet, apiSend } from "@/lib/api";
import { API_PATHS } from "@/lib/config";

export type NewOrder = {
  order_code?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  customer_address: string;
  product: number;
  quantity: number;
  order_status?: string;
  payment_status: string;
};

export type OrdersResponse<T> = { status: string; total_orders: number; orders: T[] };

export type ApiOrderItem = {
  id: number;
  product: number | null;
  name: string;
  price: string;
  size: string;
  quantity: number;
  line_total: string;
  image: string | null;
};

export type ApiOrder = {
  id: number;
  order_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  city?: string;
  product: number | null;
  product_name?: string;
  product_image_url?: string;
  quantity: number;
  total_amount: string;
  order_status: string;
  payment_status: string;
  payment_method?: "cod" | "card_demo";
  order_date: string;
  items?: ApiOrderItem[];
};

export type CartRow = {
  id: number;
  product: {
    id: number;
    name: string;
    category?: string;
    price: string | number;
    image?: string | null;
    image_url?: string | null;
    stock_quantity?: number;
    status?: string;
    sizes?: string[];
    size_m_stock?: number;
    [key: string]: unknown;
  };
  size: string;
  quantity: number;
};

export type CartResponse = {
  status: string;
  items: CartRow[];
  subtotal: string | number;
  count: number;
  cart: { id: number; items: CartRow[]; subtotal: string | number; count: number };
  item_id?: number;
  merged?: number;
  skipped?: Array<{ product: number; size: string; reason: string }>;
};

export type CheckoutInput = {
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  customer_address: string;
  city?: string;
  payment_method: "cod" | "card_demo";
};

/** Cart, checkout and order endpoints. Every one requires a signed-in user. */
export const ordersApi = {
  create: (order: NewOrder) => apiSend<{ status: string; message: string; order: unknown }>("POST", API_PATHS.orders, order),
  list: <T = unknown>() => apiGet<OrdersResponse<T>>(API_PATHS.orders),
  detail: <T = ApiOrder>(id: number | string) => apiGet<{ status: string; order: T }>(`${API_PATHS.orders}${id}/`),
  cancel: (id: number | string) =>
    apiSend<{ status: string; message: string; order: ApiOrder }>("POST", `${API_PATHS.orders}${id}/cancel/`),
  updateStatus: (id: number | string, order_status: string) =>
    apiSend<{ status: string; order: ApiOrder }>("PATCH", `${API_PATHS.orders}${id}/status/`, { order_status }),

  getCart: () => apiGet<CartResponse>("/api/cart/"),
  addToCart: (product: number | string, size = "M", quantity = 1) =>
    apiSend<CartResponse>("POST", "/api/cart/", { product: Number(product), size, quantity }),
  updateCartItem: (itemId: number, quantity: number, size?: string) =>
    apiSend<CartResponse>("PATCH", `/api/cart/items/${itemId}/`, { quantity, ...(size ? { size } : {}) }),
  removeCartItem: (itemId: number) => apiSend<CartResponse>("DELETE", `/api/cart/items/${itemId}/`),
  clearCart: () => apiSend<CartResponse>("DELETE", "/api/cart/"),
  mergeCart: (items: Array<{ product: number; size: string; quantity: number }>) =>
    apiSend<CartResponse>("POST", "/api/cart/merge/", { items }),
  checkout: (input: CheckoutInput) =>
    apiSend<{ status: string; message: string; order: ApiOrder }>("POST", "/api/checkout/", input),
};

/** Message to show when an order could not be placed. */
export function orderErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong while placing your order.";
}
