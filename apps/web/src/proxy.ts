import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_LOGIN_PATH, isPrivateAdminPath, isPrivatePath } from "@/lib/routes";

/** JS-readable hint set by Django next to the admin cookies (those are scoped to /api/admin/). */
export const ADMIN_SESSION_HINT = "wr-admin-session";

function redirectTo(request: NextRequest, pathname: string) {
  const { pathname: from, search } = request.nextUrl;
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = `?next=${encodeURIComponent(from + search)}`;
  return NextResponse.redirect(target);
}

/**
 * Next.js 16's middleware. Cookies are only checked for presence here: Django validates them
 * on every API call, and the client guards handle expired sessions and missing permissions.
 *
 * - Shop pages: visitors without a shop session go to /login?next=...
 * - Admin pages: visitors without an admin session go to /admin/login?next=... A shop session
 *   never opens the admin panel; the two logins are separate.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPrivateAdminPath(pathname)) {
    if (request.cookies.get(ADMIN_SESSION_HINT)?.value === "1") return NextResponse.next();
    return redirectTo(request, ADMIN_LOGIN_PATH);
  }

  if (!isPrivatePath(pathname)) return NextResponse.next();

  // The access cookie lasts 30 minutes; the refresh cookie keeps the session alive for 7 days.
  const hasSession = request.cookies.has("wr-access") || request.cookies.has("wr-refresh");
  if (hasSession) return NextResponse.next();
  return redirectTo(request, "/login");
}

export const config = {
  matcher: [
    "/profile/:path*",
    "/my-orders/:path*",
    "/orders/:path*",
    "/order-confirmation/:path*",
    "/checkout/:path*",
    "/bookings/:path*",
    "/admin/:path*",
  ],
};
