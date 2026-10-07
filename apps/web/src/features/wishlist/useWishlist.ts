"use client";

import { useCallback, useSyncExternalStore } from "react";
import { notify } from "@/lib/notify";
import { createLocalStore } from "@/features/storage/localStore";
import type { CartProduct } from "@/features/cart/types";

// Same key the legacy client used, so existing wishlists survive the port.
export const WISHLIST_STORAGE_KEY = "wearRightWishlist";

export const wishlistStore = createLocalStore<CartProduct[]>(WISHLIST_STORAGE_KEY, []);

const sameId = (a: number | string, b: number | string) => String(a) === String(b);

export function useWishlist() {
  const wishlistItems = useSyncExternalStore(
    wishlistStore.subscribe,
    wishlistStore.getSnapshot,
    wishlistStore.getServerSnapshot,
  );

  const isInWishlist = useCallback(
    (productId: number | string) => wishlistItems.some((item) => sameId(item.id, productId)),
    [wishlistItems],
  );

  const addToWishlist = useCallback((product: CartProduct) => {
    const current = wishlistStore.getSnapshot();
    if (current.some((item) => sameId(item.id, product.id))) {
      notify(`${product.name} is already in wishlist.`);
      return;
    }
    wishlistStore.set([...current, product]);
    notify(`${product.name} added to wishlist.`);
  }, []);

  const removeFromWishlist = useCallback((productId: number | string) => {
    wishlistStore.set(wishlistStore.getSnapshot().filter((item) => !sameId(item.id, productId)));
  }, []);

  const toggleWishlist = useCallback(
    (product: CartProduct) => {
      if (wishlistStore.getSnapshot().some((item) => sameId(item.id, product.id))) {
        removeFromWishlist(product.id);
        notify(`${product.name} removed from wishlist.`);
        return;
      }
      addToWishlist(product);
    },
    [addToWishlist, removeFromWishlist],
  );

  return { wishlistItems, isInWishlist, addToWishlist, removeFromWishlist, toggleWishlist };
}
