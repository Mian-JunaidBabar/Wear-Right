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
export const ADMIN_FORGOT_PASSWORD_PATH = "/admin/forgot-password";
export const ADMIN_RESET_PASSWORD_PATH = "/admin/reset-password";
export const ADMIN_PUBLIC_PATHS = [ADMIN_LOGIN_PATH, ADMIN_FORGOT_PASSWORD_PATH, ADMIN_RESET_PASSWORD_PATH] as const;

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

export function isPublicAdminPath(pathname: string): boolean {
  return (ADMIN_PUBLIC_PATHS as readonly string[]).includes(pathname);
}

/** Admin pages other than login, forgot password and reset password need an admin session. */
export function isPrivateAdminPath(pathname: string): boolean {
  return isAdminPath(pathname) && !isPublicAdminPath(pathname);
}

/** Only follow `?next=` to a path on this site (blocks https://evil.example and //evil.example). */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
