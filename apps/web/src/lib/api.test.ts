import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, apiSend, onSessionExpired, parseApiError } from "./api";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const UNAUTH = { error: { code: "NotAuthenticated", message: "Authentication credentials were not provided.", details: {} } };

function clearCookies() {
  for (const part of document.cookie.split("; ")) {
    const name = part.split("=")[0];
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

beforeEach(() => clearCookies());
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseApiError", () => {
  it("reads the backend error format", () => {
    const err = parseApiError(403, { error: { code: "PermissionDenied", message: "Nope", details: { a: 1 } } });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe("PermissionDenied");
    expect(err.message).toBe("Nope");
    expect(err.details).toEqual({ a: 1 });
  });

  it("understands the older view-level error shapes", () => {
    expect(parseApiError(400, { status: "error", message: "Only 2 item(s) available in stock" }).message).toBe(
      "Only 2 item(s) available in stock",
    );
    expect(parseApiError(400, { status: "error", errors: { quantity: ["Too many."] } }).message).toBe("Too many.");
    expect(parseApiError(400, { error: "No image frame provided" }).message).toBe("No image frame provided");
  });

  it("falls back to a generic message for unknown bodies", () => {
    const err = parseApiError(502, "<html>bad gateway</html>");
    expect(err.status).toBe(502);
    expect(err.message).toBe("Request failed (502)");
  });
});

describe("apiGet / apiSend", () => {
  it("sends credentials and returns parsed JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ status: "success" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiGet<{ status: string }>("/api/products/")).resolves.toEqual({ status: "success" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/products/");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", credentials: "include" });
  });

  it("serialises JSON bodies and passes FormData through untouched", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json({ ok: true }, 201)));
    vi.stubGlobal("fetch", fetchMock);
    await apiSend("POST", "/api/orders/", { quantity: 2 });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify({ quantity: 2 }) });
    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBe("application/json");

    const form = new FormData();
    form.append("image", "x");
    await apiSend("POST", "/api/scanner/analyze/", form);
    expect(fetchMock.mock.calls[1][1].body).toBe(form);
    expect(fetchMock.mock.calls[1][1].headers["Content-Type"]).toBeUndefined();
  });

  it("throws a typed ApiError for error responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: { code: "NotFound", message: "Missing" } }, 404)));
    await expect(apiGet("/api/products/999/")).rejects.toMatchObject({ status: 404, code: "NotFound" });
  });
});

describe("CSRF header", () => {
  it("echoes the csrftoken cookie on unsafe requests only", async () => {
    document.cookie = "csrftoken=abc123; Path=/";
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json({})));
    vi.stubGlobal("fetch", fetchMock);

    await apiGet("/api/orders/");
    await apiSend("POST", "/api/orders/", {});
    await apiSend("PATCH", "/api/auth/me/", {});
    await apiSend("DELETE", "/api/orders/1/");

    expect(fetchMock.mock.calls[0][1].headers["X-CSRFToken"]).toBeUndefined();
    for (const index of [1, 2, 3]) expect(fetchMock.mock.calls[index][1].headers["X-CSRFToken"]).toBe("abc123");
  });

  it("sends no header when there is no csrftoken cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    vi.stubGlobal("fetch", fetchMock);
    await apiSend("POST", "/api/orders/", {});
    expect(fetchMock.mock.calls[0][1].headers["X-CSRFToken"]).toBeUndefined();
  });
});

describe("refresh and retry", () => {
  it("refreshes the token once on a 401 and retries the request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(UNAUTH, 401)) // original request
      .mockResolvedValueOnce(json({ detail: "Token refreshed." })) // refresh
      .mockResolvedValueOnce(json({ orders: [] })); // retry
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiGet("/api/orders/")).resolves.toEqual({ orders: [] });
    expect(fetchMock.mock.calls.map((call) => [call[0], call[1].method])).toEqual([
      ["/api/orders/", "GET"],
      ["/api/auth/token/refresh/", "POST"],
      ["/api/orders/", "GET"],
    ]);
  });

  it("gives up when the refresh fails: one refresh, no retry, session-expired is announced", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(UNAUTH, 401))
      .mockResolvedValueOnce(json({ error: { code: "InvalidToken", message: "bad" } }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);

    await expect(apiGet("/api/orders/")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(expired).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("never loops: a retry that is still 401 is not refreshed a second time", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(UNAUTH, 401))
      .mockResolvedValueOnce(json({ detail: "Token refreshed." }))
      .mockResolvedValue(json(UNAUTH, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiGet("/api/orders/")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3); // request, refresh, retry. Nothing more.
  });

  it("does not try to refresh for the auth endpoints themselves", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(json({ error: { code: "ValidationError", message: "Incorrect email or password." } }, 401)));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiSend("POST", "/api/auth/login/", {})).rejects.toBeInstanceOf(ApiError);
    await expect(apiSend("POST", "/api/auth/token/refresh/", {})).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("parallel 401s share one refresh", async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      if (url === "/api/auth/token/refresh/") {
        refreshCalls += 1;
        return json({ detail: "Token refreshed." });
      }
      // first hit of each path is a 401, the retry succeeds
      const key = `${init.method} ${url}`;
      const seen = (fetchMock as unknown as { seen?: Set<string> }).seen ?? new Set<string>();
      (fetchMock as unknown as { seen?: Set<string> }).seen = seen;
      if (!seen.has(key)) {
        seen.add(key);
        return json(UNAUTH, 401);
      }
      return json({ ok: url });
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.all([apiGet("/api/orders/"), apiGet("/api/bookings/")]);
    expect(results).toEqual([{ ok: "/api/orders/" }, { ok: "/api/bookings/" }]);
    expect(refreshCalls).toBe(1);
  });

  it("treats a network failure during refresh as a failed refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(UNAUTH, 401)).mockRejectedValueOnce(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiGet("/api/orders/")).rejects.toMatchObject({ status: 401 });
  });
});
