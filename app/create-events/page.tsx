/**
 * Create events page -- form for creating new events with CreateEventForm.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/server";
import { canCreateEvent } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import CreateEventForm from "../components/CreateEventForm";
import { Card } from "../components/ui/card";
import { PageShell } from "../components/ui/page-shell";
import { buttonVariants } from "../components/ui/button";
import { cn } from "../components/ui/cn";
import { PageIntro, Section, Stack } from "../components/ui/primitives";
import { Category } from "../types/catagory";
import { getCategories } from "@/lib/data/categories";

export const dynamic = "force-dynamic";

export default async function CreateEventsPage() {
  const { data } = await auth.getSession();
  const user = (data?.user as { id?: string; role?: string | null } | null) ?? null;
  if (!user?.id) {
    redirect("/auth/sign-in?redirect=%2Fcreate-events");
  }
  if (!canCreateEvent(user)) {
    redirect("/profile");
  }

  const [categories, payoutProfile] = await Promise.all([
    getCategories() as Promise<Category[]>,
    user.role === "pitch_owner"
      ? prisma.pitchOwnerProfile.findUnique({
          where: { userId: user.id },
          select: {
            chapaSubaccountId: true,
            payoutSetupVerifiedAt: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const payoutReady =
    user.role !== "pitch_owner" ||
    Boolean(
      payoutProfile?.chapaSubaccountId &&
        payoutProfile.payoutSetupVerifiedAt,
    );

  return (
    <PageShell containerClassName="mx-auto max-w-7xl">
      <Stack gap="xl">
        <Section size="md" className="pb-0">
          <PageIntro
            kicker="Host on Meda"
            title={<>Create a match with calmer structure and clearer commitment.</>}
            description="Set the pitch details, time, location, pricing, and capacity once. The interface now gives the form better hierarchy, better preview separation, and cleaner mobile spacing."
          />
        </Section>

        <Section size="sm" className="pt-0">
          {payoutReady ? (
            <CreateEventForm categories={categories} creatorRole={user.role ?? "user"} />
          ) : (
            <Card className="space-y-4 p-6 sm:p-8">
              <div className="space-y-2">
                <p className="heading-kicker">Payout required</p>
                <h2 className="section-title">Complete payout setup first</h2>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  Pitch owners must verify a Chapa payout account before creating events. That setup enables ticket settlement and split payments.
                </p>
              </div>
              <Link
                href="/profile"
                className={cn(buttonVariants("primary", "md"), "w-fit rounded-full")}
              >
                Open payout settings
              </Link>
            </Card>
          )}
        </Section>
      </Stack>
    </PageShell>
  );
}
