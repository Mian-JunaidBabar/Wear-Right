"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { notify } from "@/lib/notify";
import { createLocalStore } from "@/features/storage/localStore";
import { useOptionalAuth } from "@/features/auth/AuthProvider";
import { ordersApi, type CartResponse, type CartRow } from "@/features/orders/api";
import type { CartItem, CartProduct } from "./types";

/** Guests keep their cart in this browser; it is merged into the server cart after login. */
export const CART_STORAGE_KEY = "wearRightCart";

export const cartStore = createLocalStore<CartItem[]>(CART_STORAGE_KEY, []);

/** Signed-in carts live on the server. Every useCart() on the page reads this
 * one snapshot, so the navbar badge updates when a product card adds an item. */
const emptyServerItems: CartItem[] = [];
let serverItemsSnapshot: CartItem[] = emptyServerItems;
const serverItemsListeners = new Set<() => void>();

const serverItemsStore = {
  subscribe(listener: () => void) {
    serverItemsListeners.add(listener);
    return () => serverItemsListeners.delete(listener);
  },
  getSnapshot: () => serverItemsSnapshot,
  getServerSnapshot: () => emptyServerItems,
  set(items: CartItem[]) {
    serverItemsSnapshot = items;
    serverItemsListeners.forEach((listener) => listener());
  },
};

const sameId = (a: number | string, b: number | string) => String(a) === String(b);

function toCartItem(row: CartRow): CartItem {
  return {
    id: row.id,
    size: row.size,
    quantity: row.quantity,
    product: {
      ...(row.product as CartProduct),
      id: row.product.id,
      name: row.product.name,
      category: row.product.category || "Wear Right Product",
      price: row.product.price,
      image: row.product.image || null,
      image_url: row.product.image_url || null,
      stock_quantity: Number(row.product.stock_quantity || 0),
      status: row.product.status || "Active",
    },
  };
}

/**
 * Cart for both guests and signed-in users. A guest's localStorage cart is
 * merged into the server cart once login completes, then the server is the
 * source of truth (so it follows the account across devices).
 */
export function useCart() {
  const auth = useOptionalAuth();
  const loggedIn = Boolean(auth?.user.isLoggedIn);
  const localItems = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot);
  const serverItems = useSyncExternalStore(
    serverItemsStore.subscribe,
    serverItemsStore.getSnapshot,
    serverItemsStore.getServerSnapshot,
  );
  const [syncing, setSyncing] = useState(false);
  const [loadedForUser, setLoadedForUser] = useState<number | null>(null);
  // Responses can arrive out of order (the first cart fetch racing an add).
  // Only the newest request is allowed to replace the visible cart.
  const requestSeq = useRef(0);

  const applyResponse = useCallback((data: CartResponse) => {
    serverItemsStore.set((data.items || []).map(toCartItem));
  }, []);

  const applyIfLatest = useCallback(
    (token: number, data: CartResponse) => {
      if (token === requestSeq.current) applyResponse(data);
    },
    [applyResponse],
  );

  useEffect(() => {
    // Guests read their local cart below; there is nothing to fetch.
    if (!loggedIn) return;

    let cancelled = false;
    const userId = auth?.user.id ?? null;
    const guestItems = cartStore.getSnapshot();
    const token = ++requestSeq.current;

    async function sync() {
      setSyncing(true);
      try {
        let data: CartResponse;
        const rows = guestItems
          .map((item) => ({
            product: Number(item.product.id),
            size: item.size || item.product.size || "M",
            quantity: item.quantity,
          }))
          .filter((row) => Number.isFinite(row.product));

        if (rows.length > 0) {
          data = await ordersApi.mergeCart(rows);
          cartStore.set([]);
        } else {
          data = await ordersApi.getCart();
        }
        if (!cancelled) {
          applyIfLatest(token, data);
          setLoadedForUser(userId);
        }
      } catch {
        if (!cancelled) setLoadedForUser(userId);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    }

    void sync();
    return () => {
      cancelled = true;
    };
    // The auth user id changes on login/logout; the guest cart is read at that moment.
  }, [loggedIn, auth?.user.id, applyIfLatest]);

  const addToCart = useCallback(
    (product: CartProduct) => {
      notify(`${product.name} added to cart.`);
      if (!loggedIn) {
        const current = cartStore.getSnapshot();
        const size = product.size || "M";
        const existing = current.find(
          (item) => sameId(item.product.id, product.id) && (item.size || "M") === size,
        );
        cartStore.set(
          existing
            ? current.map((item) =>
                sameId(item.product.id, product.id) && (item.size || "M") === size
                  ? { ...item, quantity: item.quantity + 1 }
                  : item,
              )
            : [...current, { product, quantity: 1, size: product.size }],
        );
        return;
      }

      const token = ++requestSeq.current;
      void ordersApi
        .addToCart(product.id, product.size || "M", 1)
        .then((data) => applyIfLatest(token, data))
        .catch((error) => notify(error instanceof Error ? error.message : "Could not add to cart.", "error"));
    },
    [loggedIn, applyIfLatest],
  );

  const removeFromCart = useCallback(
    (productId: number | string, size?: string) => {
      if (!loggedIn) {
        cartStore.set(
          cartStore
            .getSnapshot()
            .filter((item) => !(sameId(item.product.id, productId) && (!size || (item.size || "M") === size))),
        );
        return;
      }
      const row = serverItems.find(
        (item) => sameId(item.product.id, productId) && (!size || (item.size || "M") === size),
      );
      if (!row?.id) return;
      const token = ++requestSeq.current;
      void ordersApi
        .removeCartItem(row.id)
        .then((data) => applyIfLatest(token, data))
        .catch((error) => notify(error instanceof Error ? error.message : "Could not remove item.", "error"));
    },
    [loggedIn, serverItems, applyIfLatest],
  );

  const updateCartQuantity = useCallback(
    (productId: number | string, quantity: number, size?: string) => {
      if (quantity <= 0) {
        removeFromCart(productId, size);
        return;
      }
      if (!loggedIn) {
        cartStore.set(
          cartStore
            .getSnapshot()
            .map((item) =>
              sameId(item.product.id, productId) && (!size || (item.size || "M") === size)
                ? { ...item, quantity }
                : item,
            ),
        );
        return;
      }
      const row = serverItems.find(
        (item) => sameId(item.product.id, productId) && (!size || (item.size || "M") === size),
      );
      if (!row?.id) return;
      const token = ++requestSeq.current;
      void ordersApi
        .updateCartItem(row.id, quantity)
        .then((data) => applyIfLatest(token, data))
        .catch((error) => notify(error instanceof Error ? error.message : "Could not update cart.", "error"));
    },
    [loggedIn, serverItems, removeFromCart, applyIfLatest],
  );

  const clearCart = useCallback(() => {
    if (!loggedIn) {
      cartStore.set([]);
      return;
    }
    const token = ++requestSeq.current;
    void ordersApi
      .clearCart()
      .then((data) => applyIfLatest(token, data))
      .catch((error) => notify(error instanceof Error ? error.message : "Could not clear cart.", "error"));
  }, [loggedIn, applyIfLatest]);

  const cartItems = loggedIn ? serverItems : localItems;
  const cartCount = useMemo(() => cartItems.reduce((total, item) => total + item.quantity, 0), [cartItems]);
  const cartTotal = useMemo(
    () => cartItems.reduce((total, item) => total + Number(item.product.price || 0) * item.quantity, 0),
    [cartItems],
  );

  return {
    cartItems,
    cartCount,
    cartTotal,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    syncing: loggedIn && (syncing || loadedForUser !== (auth?.user.id ?? null)),
    isServerCart: loggedIn,
  };
}
