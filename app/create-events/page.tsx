/**
 * Create events page -- form for creating new events with CreateEventForm.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/server";
import { canCreateEvent } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import CreateEventForm from "../components/CreateEventForm";
import { PageShell } from "../components/ui/page-shell";
import { buttonVariants } from "../components/ui/button";
import { cn } from "../components/ui/cn";
import { Stack } from "../components/ui/primitives";
import { Card } from "../components/ui/card";
import { AppPageHeader } from "../components/ui/app-page-header";
import { AppSectionCard } from "../components/ui/app-section-card";
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
    <PageShell containerClassName="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Stack gap="xl">
        <AppPageHeader
          kicker="Create match"
          title="Use this when you are publishing a real match, not just opening booking times."
          description="Booking times are the simpler path for hosts. Create a match when players are joining a specific organized game with its own details, image, and description."
          primaryAction={
            <Link
              href="/host?view=calendar"
              className={cn(buttonVariants("secondary", "md"), "rounded-full")}
            >
              Back to Host calendar
            </Link>
          }
          secondaryActions={
            <Link
              href="/host?view=places"
              className={cn(buttonVariants("ghost", "md"), "rounded-full")}
            >
              Edit places
            </Link>
          }
        />

        <AppSectionCard
          headingKicker="Before you publish"
          title="Choose the right publishing path"
          description="Booking times are for simple availability. Matches are for organized games people join as an event."
          density="compact"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
              <p className="text-base font-semibold text-[var(--color-text-primary)]">Use booking times when</p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                You want to open playable 2-hour windows on the host calendar and let people reserve them.
              </p>
            </div>
            <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-control-bg)] p-4">
              <p className="text-base font-semibold text-[var(--color-text-primary)]">Use create match when</p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                You are running a specific match with its own story, image, level, and event page.
              </p>
            </div>
          </div>
        </AppSectionCard>

        <div>
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
        </div>
      </Stack>
    </PageShell>
  );
}
