import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/errors.js";

export function notFoundHandler(
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  res.status(404).json({ error: { code: "not_found", message: "Not found" } });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message } });
    return;
  }

  console.error("Unhandled error", error);
  res.status(500).json({
    error: { code: "internal_error", message: "Something went wrong" },
  });
}
