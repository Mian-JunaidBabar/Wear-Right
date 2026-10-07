import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartProduct } from "@/features/cart/types";
import { WISHLIST_STORAGE_KEY, useWishlist, wishlistStore } from "./useWishlist";

const shirt: CartProduct = { id: 1, name: "Linen Shirt", category: "Men Shirt", price: 3500 };

beforeEach(() => {
  window.localStorage.clear();
  wishlistStore.set([]);
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("useWishlist", () => {
  it("adds once, refuses duplicates, toggles off, and persists", () => {
    const { result } = renderHook(() => useWishlist());
    act(() => result.current.addToWishlist(shirt));
    act(() => result.current.addToWishlist(shirt));
    expect(result.current.wishlistItems).toHaveLength(1);
    expect(result.current.isInWishlist("1")).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(WISHLIST_STORAGE_KEY)!)).toHaveLength(1);

    act(() => result.current.toggleWishlist(shirt));
    expect(result.current.wishlistItems).toEqual([]);
    act(() => result.current.toggleWishlist(shirt));
    act(() => result.current.removeFromWishlist(1));
    expect(result.current.wishlistItems).toEqual([]);
  });

  it("survives storage failure", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useWishlist());
    expect(() => act(() => result.current.addToWishlist(shirt))).not.toThrow();
    expect(result.current.wishlistItems).toHaveLength(1);
  });
});
