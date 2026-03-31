import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { revokeShareLink } from "@/services/ticketSharing";
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const rl = await checkRateLimit(`share-revoke:${getClientId(request)}`, 10, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many revoke attempts. Please wait before trying again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;

  const parsed = parseParams(shareTokenParamSchema, await params);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid share token");
  }
  const { token } = parsed.data;
  try {
    const result = await revokeShareLink({
      token,
      ownerUserId: session.user.id,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
