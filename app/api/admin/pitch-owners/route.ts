import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/guards";
import { uuidSchema } from "@/lib/validations/events";
import { parseJsonBody, validationErrorResponse } from "@/lib/validations/http";
import { ensurePitchOwnerProfile, listPitchOwnerProfiles } from "@/services/pitchOwner";

const createPitchOwnerSchema = z.object({
  userId: uuidSchema,
  businessName: z.string().trim().max(255).optional(),
});

export async function GET() {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const items = await listPitchOwnerProfiles();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;

  const bodyParse = await parseJsonBody(createPitchOwnerSchema, request);
  if (!bodyParse.success) {
    return validationErrorResponse(bodyParse.error, "Invalid pitch owner payload");
  }

  try {
    const result = await ensurePitchOwnerProfile(bodyParse.data);
    return NextResponse.json(
      { profile: result.profile, created: result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create pitch owner";
    return NextResponse.json(
      { error: message },
      { status: message === "User not found" ? 404 : 400 },
    );
  }
}
