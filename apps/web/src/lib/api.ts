/**
 * The only place in the web app that calls fetch.
 * All URLs are relative: the browser talks to port 3000 and next.config.ts
 * rewrites /api/* and /media/* to Django. Always use a trailing slash.
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

/** Builds an ApiError from the backend's {"error": {code, message, details}} body. */
export function parseApiError(status: number, body: unknown): ApiError {
  if (isRecord(body) && isRecord(body.error)) {
    const { code, message, details } = body.error;
    return new ApiError(
      status,
      typeof code === "string" ? code : "Error",
      typeof message === "string" && message ? message : `Request failed (${status})`,
      details,
    );
  }
  return new ApiError(status, "Error", `Request failed (${status})`, body);
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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(path, {
    method,
    headers,
    body: payload,
    credentials: "include",
  });
  const data = await readBody(response);
  if (!response.ok) throw parseApiError(response.status, data);
  return data as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiSend<T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  return request<T>(method, path, body);
}
