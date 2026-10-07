import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, apiSend, parseApiError } from "./api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

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

  it("falls back to a generic message for unknown bodies", () => {
    const err = parseApiError(502, "<html>bad gateway</html>");
    expect(err.status).toBe(502);
    expect(err.message).toBe("Request failed (502)");
  });
});

describe("apiGet / apiSend", () => {
  it("sends credentials and returns parsed JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "success" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiGet<{ status: string }>("/api/products/")).resolves.toEqual({ status: "success" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/products/");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", credentials: "include" });
  });

  it("serialises JSON bodies for writes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await apiSend("POST", "/api/orders/", { quantity: 2 });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify({ quantity: 2 }) });
  });

  it("throws a typed ApiError for error responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: "NotFound", message: "Missing" } }, 404)),
    );
    await expect(apiGet("/api/products/999/")).rejects.toMatchObject({ status: 404, code: "NotFound" });
  });
});
