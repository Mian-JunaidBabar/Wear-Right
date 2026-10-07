// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function request(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);
}

describe("proxy", () => {
  it("redirects a signed-out visitor from a private page to /login?next=", () => {
    const response = proxy(request("/profile?tab=style"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/profile?tab=style");
  });

  it("lets a visitor with a session cookie through", () => {
    expect(proxy(request("/my-orders", "wr-access=abc")).headers.get("location")).toBeNull();
    // access expired but refresh still valid: the client refreshes, so do not bounce them
    expect(proxy(request("/my-orders", "wr-refresh=abc")).headers.get("location")).toBeNull();
  });

  it("leaves public pages alone", () => {
    for (const path of ["/", "/shop", "/product/1", "/scanner", "/login", "/register"]) {
      expect(proxy(request(path)).headers.get("location")).toBeNull();
    }
  });
});
