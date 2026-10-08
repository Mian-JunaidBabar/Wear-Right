import { describe, expect, it } from "vitest";
import { normalizeSkinTone, normalizeStyle, prettyLabel } from "./recommendationRules";

describe("normalizeSkinTone", () => {
  it("maps the scanner's depth names and common words", () => {
    expect(normalizeSkinTone("Fair")).toBe("fair");
    expect(normalizeSkinTone(" LIGHT ")).toBe("fair");
    expect(normalizeSkinTone("Dark")).toBe("dark");
    expect(normalizeSkinTone("deep")).toBe("dark");
    expect(normalizeSkinTone("Medium")).toBe("medium");
  });

  it("falls back to medium for anything unknown or missing", () => {
    expect(normalizeSkinTone(undefined)).toBe("medium");
    expect(normalizeSkinTone("Rescan Required")).toBe("medium");
  });
});

describe("normalizeStyle", () => {
  it("reads style tags in any case and defaults to western", () => {
    expect(normalizeStyle("Eastern")).toBe("eastern");
    expect(normalizeStyle("CASUAL")).toBe("casual");
    expect(normalizeStyle("formal wear")).toBe("formal");
    expect(normalizeStyle(null)).toBe("western");
  });
});

describe("prettyLabel", () => {
  it("capitalises each word", () => {
    expect(prettyLabel("navy blue")).toBe("Navy Blue");
  });
});
