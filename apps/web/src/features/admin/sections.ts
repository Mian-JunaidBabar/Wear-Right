import type { AdminPermission } from "./api";

/** Admin panel sections. Each has its own URL (/admin/<slug>) and the permission needed to open it. */
export const ADMIN_SECTIONS = [
  { id: "dashboard", path: "/admin", label: "Dashboard", permission: "dashboard.view" },
  { id: "products", path: "/admin/products", label: "Products", permission: "products.view" },
  { id: "styles", path: "/admin/categories", label: "Categories & Styles", permission: "products.view" },
  { id: "skinTone", path: "/admin/skin-tones", label: "Skin Tone Matrix", permission: "products.view" },
  { id: "outfitRules", path: "/admin/outfit-rules", label: "Outfit Rules", permission: "products.view" },
  { id: "orders", path: "/admin/orders", label: "Orders", permission: "orders.view" },
  { id: "bookings", path: "/admin/bookings", label: "Bookings", permission: "bookings.view" },
  { id: "faceScans", path: "/admin/face-scans", label: "Face Scans", permission: "scans.view" },
  { id: "team", path: "/admin/team", label: "Team & Roles", permission: "team.manage" },
  { id: "settings", path: "/admin/settings", label: "Settings", permission: null },
] as const satisfies ReadonlyArray<{ id: string; path: string; label: string; permission: AdminPermission | null }>;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];

/** URL slugs for /admin/[section] (the dashboard is /admin itself). */
export const ADMIN_SECTION_SLUGS = ADMIN_SECTIONS.filter((s) => s.path !== "/admin").map((s) => s.path.slice("/admin/".length));

export function sectionFromPath(pathname: string): AdminSectionId | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const match = ADMIN_SECTIONS.find((s) => s.path === clean);
  return match ? match.id : null;
}
