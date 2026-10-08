/**
 * Small label helpers for the recommender pages.
 *
 * The colour rules that used to live here (which colours suit which skin tone) moved to the
 * backend in phase 4: they are the `ToneColorRule` table, editable by staff, and the pages read
 * them through `features/recommender/api.ts`. Do not add colour rules back to the client.
 */
export type SkinToneKey = "fair" | "medium" | "dark";
export type StyleKey = "eastern" | "western" | "casual" | "formal";

export function normalizeText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeSkinTone(value?: string | null): SkinToneKey {
  const text = normalizeText(value);
  if (text.includes("fair") || text.includes("light")) return "fair";
  if (text.includes("dark") || text.includes("deep")) return "dark";
  return "medium";
}

export function normalizeStyle(value?: string | null): StyleKey {
  const text = normalizeText(value);
  if (text.includes("eastern")) return "eastern";
  if (text.includes("casual")) return "casual";
  if (text.includes("formal")) return "formal";
  return "western";
}

export function prettyLabel(value: string) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
