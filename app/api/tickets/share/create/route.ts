import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/guards";
import { createShareLinkSchema } from "@/lib/validations/ticketSharing";
import { createShareLink } from "@/services/ticketSharing";

function formatUnknownError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown share-link error";
  }
}

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;

  const body = await request.json().catch(() => null);
  const parsed = createShareLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() || new URL(request.url).origin;
  try {
    const result = await createShareLink({
      eventId: parsed.data.eventId,
      ownerUserId: session.user.id,
      baseUrl,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
