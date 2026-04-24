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

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  Object.assign(headers, options.headers ?? {});

  const fetchInit: RequestInit = {
    method,
    credentials: "include",
    headers,
    ...(body !== undefined ? { body } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };

  const response = await fetch(path, fetchInit);

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
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, options ?? {}),
};
