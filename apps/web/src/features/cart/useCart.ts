"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { notify } from "@/lib/notify";
import { createLocalStore } from "@/features/storage/localStore";
import type { CartItem, CartProduct } from "./types";

// Phase 6 moves the cart to the server; until then it lives in this browser.
export const CART_STORAGE_KEY = "wearRightCart";

export const cartStore = createLocalStore<CartItem[]>(CART_STORAGE_KEY, []);

const sameId = (a: number | string, b: number | string) => String(a) === String(b);

export function useCart() {
  const items = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot);

  const addToCart = useCallback((product: CartProduct) => {
    const current = cartStore.getSnapshot();
    const existing = current.find((item) => sameId(item.product.id, product.id));
    cartStore.set(
      existing
        ? current.map((item) =>
            sameId(item.product.id, product.id) ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...current, { product, quantity: 1 }],
    );
    notify(`${product.name} added to cart.`);
  }, []);

  const removeFromCart = useCallback((productId: number | string) => {
    cartStore.set(cartStore.getSnapshot().filter((item) => !sameId(item.product.id, productId)));
  }, []);

  const updateCartQuantity = useCallback(
    (productId: number | string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(productId);
        return;
      }
      cartStore.set(
        cartStore
          .getSnapshot()
          .map((item) => (sameId(item.product.id, productId) ? { ...item, quantity } : item)),
      );
    },
    [removeFromCart],
  );

  const clearCart = useCallback(() => cartStore.set([]), []);

  const cartCount = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);
  const cartTotal = useMemo(
    () => items.reduce((total, item) => total + Number(item.product.price || 0) * item.quantity, 0),
    [items],
  );

  return { cartItems: items, cartCount, cartTotal, addToCart, removeFromCart, updateCartQuantity, clearCart };
}
