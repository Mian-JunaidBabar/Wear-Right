"use client";

import { useSyncExternalStore } from "react";
import { createLocalStore } from "@/features/storage/localStore";

export type ConfirmationItem = {
  id: number | string;
  name: string;
  category?: string;
  price: string | number;
  quantity: number;
  image?: string | null;
  image_url?: string | null;
};

export type ConfirmationData = {
  order_code: string;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  customer_address: string;
  payment_status: string;
  total: number;
  items: ConfirmationItem[];
  created_at: string;
};

// The summary shown on /order-confirmation right after checkout (same key as the legacy client).
export const lastOrderStore = createLocalStore<ConfirmationData | null>("wearRightLastOrder", null);

export function useLastOrder(): ConfirmationData | null {
  return useSyncExternalStore(lastOrderStore.subscribe, lastOrderStore.getSnapshot, lastOrderStore.getServerSnapshot);
}
