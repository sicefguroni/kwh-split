export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code = "bad_request"): HttpError =>
  new HttpError(400, code, message);

export const unauthorized = (message = "Unauthorized"): HttpError =>
  new HttpError(401, "unauthorized", message);

export const forbidden = (message = "Forbidden"): HttpError =>
  new HttpError(403, "forbidden", message);

export const conflict = (message: string, code = "conflict"): HttpError =>
  new HttpError(409, code, message);

export const tooManyRequests = (message: string, code = "too_many_requests"): HttpError =>
  new HttpError(429, code, message);
