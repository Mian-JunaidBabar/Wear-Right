import { NextResponse, type NextRequest } from "next/server";
import { isPrivatePath } from "@/lib/routes";

/**
 * Next.js 16's middleware. Sends visitors without a session cookie from private pages
 * to /login?next=... Cookies are only checked for presence here: Django validates them
 * on every API call, and <RequireAuth> handles expired sessions and staff-only pages.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isPrivatePath(pathname)) return NextResponse.next();

  // The access cookie lasts 30 minutes; the refresh cookie keeps the session alive for 7 days.
  const hasSession = request.cookies.has("wr-access") || request.cookies.has("wr-refresh");
  if (hasSession) return NextResponse.next();

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(login);
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
