import { NextResponse } from "next/server";
import { getShareLinkDetails } from "@/services/ticketSharing";
import { parseParams, validationErrorResponse } from "@/lib/validations/http";
import { shareTokenParamSchema } from "@/lib/validations/ticketSharing";
import { checkRateLimit, getClientId } from "@/lib/ratelimit";

function formatUnknownError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown share-link error";
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const rl = await checkRateLimit(`share-details:${getClientId(request)}`, 20, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  const parsed = parseParams(shareTokenParamSchema, await params);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid share token");
  }
  const { token } = parsed.data;
  try {
    const result = await getShareLinkDetails(token);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 404 },
    );
  }
}
