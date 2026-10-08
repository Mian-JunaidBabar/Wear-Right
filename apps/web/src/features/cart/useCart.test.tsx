import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartProduct } from "./types";
import { getToasts, resetToasts } from "@/lib/notify";
import { CART_STORAGE_KEY, cartStore, useCart } from "./useCart";

const shirt: CartProduct = { id: 1, name: "Linen Shirt", category: "Men Shirt", price: "3500" };
const tie: CartProduct = { id: "2", name: "Silk Tie", category: "Men Cap", price: 1800 };

beforeEach(() => {
  window.localStorage.clear();
  cartStore.set([]);
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
  resetToasts();
});
afterEach(() => vi.restoreAllMocks());

describe("useCart", () => {
  it("adds products, merges duplicates by id, and tells the user", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(shirt));
    act(() => result.current.addToCart(tie));
    act(() => result.current.addToCart({ ...shirt, id: "1" })); // same product, id as a string

    expect(result.current.cartItems).toHaveLength(2);
    expect(result.current.cartItems[0].quantity).toBe(2);
    expect(result.current.cartCount).toBe(3);
    expect(result.current.cartTotal).toBe(2 * 3500 + 1800);
    expect(getToasts().map((toast) => toast.message)).toContain("Linen Shirt added to cart.");
    expect(window.alert).not.toHaveBeenCalled(); // a toast, not a blocking alert
  });

  it("removes products, and removes one when its quantity drops to zero", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(shirt));
    act(() => result.current.addToCart(tie));
    act(() => result.current.updateCartQuantity(1, 4));
    expect(result.current.cartItems.find((item) => item.product.id === 1)?.quantity).toBe(4);
    act(() => result.current.updateCartQuantity(1, 0));
    expect(result.current.cartItems.map((item) => item.product.id)).toEqual(["2"]);
    act(() => result.current.removeFromCart("2"));
    expect(result.current.cartItems).toEqual([]);
  });

  it("clears the cart", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(shirt));
    act(() => result.current.clearCart());
    expect(result.current.cartCount).toBe(0);
  });

  it("persists to localStorage and restores after a reload", () => {
    const { result, unmount } = renderHook(() => useCart());
    act(() => result.current.addToCart(shirt));
    unmount();

    const stored = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!);
    expect(stored).toEqual([{ product: shirt, quantity: 1 }]);

    cartStore.reload(); // a fresh page load forgets the in-memory copy
    const { result: reloaded } = renderHook(() => useCart());
    expect(reloaded.current.cartItems).toEqual([{ product: shirt, quantity: 1 }]);
  });

  it("keeps working when localStorage throws (private mode, blocked storage)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    cartStore.reload();

    const { result } = renderHook(() => useCart());
    expect(result.current.cartItems).toEqual([]);
    expect(() => act(() => result.current.addToCart(shirt))).not.toThrow();
    expect(result.current.cartCount).toBe(1);
  });

  it("ignores a corrupt stored cart", () => {
    window.localStorage.setItem(CART_STORAGE_KEY, "oops");
    cartStore.reload();
    const { result } = renderHook(() => useCart());
    expect(result.current.cartItems).toEqual([]);
  });
});
