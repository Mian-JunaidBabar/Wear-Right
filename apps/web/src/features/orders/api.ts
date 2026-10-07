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

/** Orders belong to the signed-in user (staff see everyone's). */
export const ordersApi = {
  create: (order: NewOrder) => apiSend<{ status: string; message: string; order: unknown }>("POST", API_PATHS.orders, order),
  list: <T = unknown>() => apiGet<OrdersResponse<T>>(API_PATHS.orders),
};

/** Message to show when an order could not be placed. */
export function orderErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong while placing your order.";
}
