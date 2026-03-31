import { NextResponse } from "next/server";
import { z } from "zod";
import { formatUnknownError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import {
  parseJsonBody,
  validationErrorResponse,
} from "@/lib/validations/http";
import {
  cancelOwnerSubscription,
  confirmOwnerSubscriptionPayment,
} from "@/services/subscriptions";

const subscriptionWebhookSchema = z.union([
  z.object({
    txRef: z.string().trim().min(3),
  }),
  z.object({
    ownerId: z.string().uuid(),
    status: z.literal("CANCELLED"),
  }),
]);

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedSecret =
    process.env.CHAPA_WEBHOOK_SECRET ?? process.env.CRON_SECRET ?? "";

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(subscriptionWebhookSchema, request);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, "Invalid subscription webhook payload");
  }

  try {
    const payload = parsed.data;
    const subscription =
      "txRef" in payload
        ? (await confirmOwnerSubscriptionPayment({ txRef: payload.txRef }))
            .subscription
        : await cancelOwnerSubscription(payload.ownerId);

    return NextResponse.json({ subscription }, { status: 200 });
  } catch (error) {
    logger.error("Failed to reconcile subscription webhook", error);
    return NextResponse.json(
      { error: formatUnknownError(error) },
      { status: 400 },
    );
  }
}
