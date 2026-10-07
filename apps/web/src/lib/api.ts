/**
 * The only place in the web app that calls fetch.
 *
 * - All URLs are relative: the browser talks to port 3000 and next.config.ts
 *   rewrites /api/* and /media/* to Django. Always use a trailing slash.
 * - Auth is two httpOnly cookies set by Django; JS never sees the tokens.
 * - CSRF: unsafe requests echo the `csrftoken` cookie in X-CSRFToken (Django's
 *   double-submit check, enforced because the session is cookie-authenticated).
 * - A 401 triggers one token refresh and one retry. If that fails we give up
 *   and tell listeners the session expired. There is never a second refresh.
 */

export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Builds an ApiError from a failed response body. Understands the backend's
 * {"error": {code, message, details}} format and the older view-level
 * {"status": "error", "message" | "errors"} shapes.
 */
export function parseApiError(status: number, body: unknown): ApiError {
  const fallback = `Request failed (${status})`;
  if (isRecord(body) && isRecord(body.error)) {
    const { code, message, details } = body.error;
    return new ApiError(
      status,
      typeof code === "string" ? code : "Error",
      typeof message === "string" && message ? message : fallback,
      details,
    );
  }
  if (isRecord(body)) {
    const message =
      (typeof body.message === "string" && body.message) ||
      (typeof body.error === "string" && body.error) ||
      firstString(body.errors) ||
      fallback;
    return new ApiError(status, "Error", message, body.errors ?? body);
  }
  return new ApiError(status, "Error", fallback, body);
}

const REFRESH_PATH = "/api/auth/token/refresh/";
// These never trigger a refresh: a 401 from them is a real answer.
const NO_REFRESH_PATHS = [
  "/api/auth/login/",
  "/api/auth/register/",
  "/api/auth/logout/",
  REFRESH_PATH,
];

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    for (const part of document.cookie.split("; ")) {
      const index = part.indexOf("=");
      if (index > 0 && part.slice(0, index) === name) {
        return decodeURIComponent(part.slice(index + 1));
      }
    }
  } catch {
    // cookies unavailable
  }
  return null;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildInit(method: Method, body: unknown): RequestInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET") {
    const csrf = readCookie("csrftoken");
    if (csrf) headers["X-CSRFToken"] = csrf;
  }

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // the browser sets the multipart boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  return { method, headers, body: payload, credentials: "include" };
}

// ---- session expiry notification -----------------------------------------------------------

type Listener = () => void;
const sessionExpiredListeners = new Set<Listener>();

/** Called when a 401 could not be fixed by refreshing the token. Returns an unsubscribe. */
export function onSessionExpired(listener: Listener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

// ---- refresh (shared so parallel 401s trigger a single refresh) -----------------------------

let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(REFRESH_PATH, buildInit("POST", undefined));
        return response.ok;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response = await fetch(path, buildInit(method, body));

  if (response.status === 401 && !NO_REFRESH_PATHS.includes(path)) {
    if (await refreshSession()) {
      response = await fetch(path, buildInit(method, body)); // exactly one retry
    }
    if (response.status === 401) {
      sessionExpiredListeners.forEach((listener) => listener());
    }
  }

  const data = await readBody(response);
  if (!response.ok) throw parseApiError(response.status, data);
  return data as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiSend<T>(method: Exclude<Method, "GET">, path: string, body?: unknown): Promise<T> {
  return request<T>(method, path, body);
}
