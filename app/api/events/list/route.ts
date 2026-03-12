import { NextResponse } from "next/server";
import { listPublicEvents } from "@/services/publicEvents";
import {
  eventListQuerySchema,
} from "@/lib/validations/events";
import {
  parseSearchParams,
  validationErrorResponse,
} from "@/lib/validations/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseSearchParams(eventListQuerySchema, url.searchParams);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid event search query");
  }

  const result = await listPublicEvents(parsed.data);

  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  });
}
