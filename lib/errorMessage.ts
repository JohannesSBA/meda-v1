import { isAxiosError } from "axios";

/**
 * Extracts a human-readable error message from an unknown thrown value.
 * Handles Axios errors, Error instances, and plain strings.
 */
export function getErrorMessage(err: unknown): string {
  const payload = getErrorPayload(err);
  const validationMessage = getValidationErrorMessage(payload);

  if (validationMessage) return validationMessage;
  if (typeof payload === "string") return payload;
  if (isRecord(payload) && typeof payload.error === "string") return payload.error;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "An error occurred";
}

function getErrorPayload(err: unknown): unknown {
  if (isAxiosError(err)) {
    return err.response?.data;
  }
  if (isRecord(err) && "details" in err) {
    return err.details;
  }
  return err;
}

function getValidationErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload) || !("issues" in payload) || !isRecord(payload.issues)) {
    return null;
  }

  const issues = payload.issues;
  const formErrors = readStringArray(issues.formErrors);
  if (formErrors.length > 0) {
    return formErrors[0];
  }

  if (!isRecord(issues.fieldErrors)) {
    return null;
  }

  for (const value of Object.values(issues.fieldErrors)) {
    const fieldErrors = readStringArray(value);
    if (fieldErrors.length > 0) {
      return fieldErrors[0];
    }
  }

  return null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
