/** Pages that need a signed-in user. Everything else (home, shop, products, scanner, login, ...) is public. */
export const PRIVATE_ROUTE_PREFIXES = [
  "/profile",
  "/my-orders",
  "/orders",
  "/order-confirmation",
  "/checkout",
  "/bookings",
  "/admin",
] as const;

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Only follow `?next=` to a path on this site (blocks https://evil.example and //evil.example). */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
