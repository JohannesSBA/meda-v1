import { isAxiosError } from "axios";

/**
 * Extracts a human-readable error message from an unknown thrown value.
 * Handles Axios errors, Error instances, and plain strings.
 */
export function getErrorMessage(err: unknown): string {
  if (isAxiosError(err) && typeof err.response?.data?.error === "string") {
    return err.response.data.error;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "An error occurred";
}
