/** Shop pages that need a signed-in customer. Everything else (home, shop, products, scanner, login, ...) is public. */
export const PRIVATE_ROUTE_PREFIXES = [
  "/profile",
  "/my-orders",
  "/orders",
  "/order-confirmation",
  "/checkout",
  "/bookings",
] as const;

/** The admin panel has its own login and session, separate from shoppers. */
export const ADMIN_PREFIX = "/admin";
export const ADMIN_LOGIN_PATH = "/admin/login";

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

/** Admin pages other than the admin login need an admin session. */
export function isPrivateAdminPath(pathname: string): boolean {
  return isAdminPath(pathname) && pathname !== ADMIN_LOGIN_PATH;
}

/** Only follow `?next=` to a path on this site (blocks https://evil.example and //evil.example). */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
