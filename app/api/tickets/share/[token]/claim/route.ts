import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { claimShareLink } from "@/services/ticketSharing";

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
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await requireSessionUser();
  if (!session.user || session.response) return session.response!;

  const { token } = await params;
  try {
    const result = await claimShareLink({
      token,
      claimantUserId: session.user.id,
    });
    revalidatePath(`/events/${result.eventId}`);
    revalidatePath("/my-events");
    revalidatePath("/profile");
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
