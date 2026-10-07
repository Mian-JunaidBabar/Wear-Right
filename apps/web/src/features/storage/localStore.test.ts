import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalStore } from "./localStore";

const KEY = "test-store";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("createLocalStore", () => {
  it("returns the fallback when nothing is stored, on the server and on the client", () => {
    const store = createLocalStore<number[]>(KEY, []);
    expect(store.getSnapshot()).toEqual([]);
    expect(store.getServerSnapshot()).toEqual([]);
  });

  it("reads stored JSON and keeps the snapshot referentially stable", () => {
    window.localStorage.setItem(KEY, JSON.stringify([1, 2]));
    const store = createLocalStore<number[]>(KEY, []);
    const first = store.getSnapshot();
    expect(first).toEqual([1, 2]);
    expect(store.getSnapshot()).toBe(first);
  });

  it("persists writes and notifies subscribers", () => {
    const store = createLocalStore<number[]>(KEY, []);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set([7]);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual([7]);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set([8]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("falls back on corrupt JSON", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(createLocalStore<number[]>(KEY, [9]).getSnapshot()).toEqual([9]);
  });

  it("survives storage that throws on read and write", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const store = createLocalStore<number[]>(KEY, []);
    expect(store.getSnapshot()).toEqual([]);
    expect(() => store.set([1])).not.toThrow();
    expect(store.getSnapshot()).toEqual([1]); // still works for this visit, in memory
  });

  it("re-reads storage when another tab changes it", () => {
    const store = createLocalStore<number[]>(KEY, []);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.getSnapshot()).toEqual([]);
    window.localStorage.setItem(KEY, JSON.stringify([5]));
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot()).toEqual([5]);
  });
});
