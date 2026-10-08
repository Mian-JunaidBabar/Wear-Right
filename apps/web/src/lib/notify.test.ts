import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts, inferKind, MAX_TOASTS, notify, resetToasts, subscribeToasts, TOAST_MS } from "./notify";

beforeEach(() => {
  vi.useFakeTimers();
  resetToasts();
});
afterEach(() => {
  resetToasts();
  vi.useRealTimers();
});

describe("notify", () => {
  it("shows a toast and removes it after a few seconds", () => {
    notify("Beige Blazer added to cart.");
    expect(getToasts().map((t) => t.message)).toEqual(["Beige Blazer added to cart."]);
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(getToasts()).toHaveLength(0);
  });

  it("never opens a blocking browser alert", () => {
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    notify("Saved.");
    expect(alert).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("keeps only the newest few toasts", () => {
    for (let i = 1; i <= MAX_TOASTS + 2; i++) notify(`Message ${i}`);
    expect(getToasts().map((t) => t.message)).toEqual(["Message 3", "Message 4", "Message 5", "Message 6"]);
  });

  it("ignores an empty message", () => {
    notify("");
    expect(getToasts()).toHaveLength(0);
  });

  it("can be dismissed early, and tells subscribers about every change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToasts(listener);
    notify("One");
    const [toast] = getToasts();
    dismissToast(toast.id);
    expect(getToasts()).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    notify("Two");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("uses the kind it is given over its own guess", () => {
    notify("Added to cart.", "error");
    expect(getToasts()[0].kind).toBe("error");
  });
});

describe("inferKind", () => {
  it.each([
    ["Beige Blazer added to cart.", "success"],
    ["Changes saved successfully!", "success"],
    ["Logged out successfully.", "success"],
    ["This product is currently out of stock.", "error"],
    ["Please enter your full name.", "error"],
    ["Unable to load mannequin preview.", "error"],
    ["Quantity must be 1 or greater.", "error"],
    ["Welcome back", "info"],
  ])("%s is %s", (message, kind) => {
    expect(inferKind(message)).toBe(kind);
  });
});
