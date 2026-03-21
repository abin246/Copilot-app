import type { Request, Response, NextFunction } from "express";

export function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(err);
  const requestId = req.header("x-request-id") || undefined;

  const status = Number(err?.statusCode || err?.status || 500);
  const safeStatus = status >= 400 && status <= 599 ? status : 500;
  const message =
    safeStatus >= 500
      ? "An unexpected server error occurred."
      : String(err?.message || err?.error || "Request failed");

  // Body-parser JSON errors should be surfaced as a 400 so the UI can show a clear message.
  if (status === 400 || err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "invalid_json", message: "Invalid JSON request body.", requestId });
  }

  res.status(safeStatus).json({
    error: safeStatus >= 500 ? "internal_server_error" : "request_failed",
    message,
    requestId,
  });
}
