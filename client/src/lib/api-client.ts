import { ensureSessionRefreshed } from "./session-refresh.js";

export interface ApiErrorPayload {
  error: { code: string; message: string };
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  body?: unknown;
  headers?: Record<string, string>;
}

const AUTH_REFRESH_SKIP_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/refresh",
  "/api/auth/logout",
]);

function shouldAttemptSessionRefresh(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  if (!pathname.startsWith("/api/")) {
    return false;
  }
  return !AUTH_REFRESH_SKIP_PATHS.has(pathname);
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  options: RequestOptions = {},
  isRetryAfterRefresh = false,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      body = options.body;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
  }
  Object.assign(headers, options.headers ?? {});

  const fetchInit: RequestInit = {
    method,
    credentials: "include",
    headers,
    ...(body !== undefined ? { body } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };

  let response = await fetch(path, fetchInit);

  if (
    response.status === 401 &&
    !isRetryAfterRefresh &&
    shouldAttemptSessionRefresh(path) &&
    !options.signal?.aborted
  ) {
    const refreshed = await ensureSessionRefreshed(options.signal);
    if (refreshed) {
      return request(method, path, options, true);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const apiPayload = payload as Partial<ApiErrorPayload>;
    const message = apiPayload?.error?.message ?? "Request failed";
    const code = apiPayload?.error?.code ?? "request_failed";
    throw new ApiError(response.status, code, message);
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, options ?? {}),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...(options ?? {}), body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...(options ?? {}), body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...(options ?? {}), body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, options ?? {}),
};
