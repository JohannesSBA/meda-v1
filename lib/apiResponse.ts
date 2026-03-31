import { NextResponse } from "next/server";
import { logger } from "./logger";

/**
 * Returns a consistent JSON error response.
 * For 5xx errors the raw message is logged server-side while
 * a generic message is returned to the client.
 */
export function apiError(
  status: number,
  message: string,
  details?: Record<string, unknown>,
): NextResponse {
  if (status >= 500) {
    logger.error(`API ${status}: ${message}`, details);
    return NextResponse.json(
      { error: "Internal server error" },
      { status },
    );
  }
  return NextResponse.json(
    { error: message, ...details },
    { status },
  );
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
}
