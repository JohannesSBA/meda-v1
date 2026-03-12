import { NextResponse } from "next/server";
import type { ZodError, ZodType } from "zod";

export function searchParamsToObject(searchParams: URLSearchParams) {
  const object: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    object[key] = value;
  });
  return object;
}

export function parseSearchParams<T extends ZodType>(
  schema: T,
  searchParams: URLSearchParams,
) {
  return schema.safeParse(searchParamsToObject(searchParams));
}

export async function parseFormData<T extends ZodType>(schema: T, request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return schema.safeParse(null);
  }
  return schema.safeParse(formDataToObject(formData));
}

export async function parseJsonBody<T extends ZodType>(schema: T, request: Request) {
  const body = await request.json().catch(() => null);
  return schema.safeParse(body);
}

export function parseJsonText<T extends ZodType>(schema: T, rawBody: string) {
  const body = rawBody ? JSON.parse(rawBody) : null;
  return schema.safeParse(body);
}

export function parseParams<T extends ZodType>(schema: T, params: unknown) {
  return schema.safeParse(params);
}

function formDataToObject(formData: FormData) {
  const object: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  formData.forEach((value, key) => {
    if (key in object) {
      const current = object[key];
      object[key] = Array.isArray(current) ? [...current, value] : [current, value];
      return;
    }
    object[key] = value;
  });
  return object;
}

export function validationErrorResponse(
  error: ZodError,
  message = "Invalid request",
) {
  return NextResponse.json(
    { error: message, issues: error.flatten() },
    { status: 400 },
  );
}
