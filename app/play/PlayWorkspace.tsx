"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/app/components/ui/page-shell";
import { Section, Stack } from "@/app/components/ui/primitives";
import { buttonVariants } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/cn";
import { AppPageHeader } from "@/app/components/ui/app-page-header";
import { SlotMarketplace } from "@/app/components/bookings/SlotMarketplace";
import { EventsDiscoveryWorkspace } from "@/app/events/EventsPageClient";
import { appRoutes } from "@/lib/navigation";
import { uiCopy } from "@/lib/uiCopy";

type PlayMode = "slots" | "events";

function readMode(value: string | null): PlayMode {
  return value === "events" ? "events" : "slots";
}

export function PlayWorkspace() {
  const searchParams = useSearchParams();
  const mode = readMode(searchParams.get("mode"));

  const modeLinks = useMemo(
    () => ({
      slots: `${appRoutes.play}?mode=slots`,
      events: `${appRoutes.play}?mode=events`,
    }),
    [],
  );

  return (
    <PageShell containerClassName="mx-auto max-w-[1380px] px-0 py-4 sm:px-6 sm:py-8 lg:px-8">
      <Stack gap="xl">
        <AppPageHeader
          kicker={uiCopy.nav.play}
          title="Book a pitch or join a match."
          description="Choose one path and keep moving."
          primaryAction={
            <Link
              href={modeLinks.slots}
              className={cn(buttonVariants("primary", "md"), "rounded-full")}
            >
              {uiCopy.play.playNow}
            </Link>
          }
          secondaryActions={
            <Link
              href={modeLinks.events}
              className={cn(buttonVariants("secondary", "md"), "rounded-full")}
            >
              {uiCopy.play.findMatch}
            </Link>
          }
        />

        {mode === "slots" ? (
          <Section size="sm" className="pt-0">
            <Card className="overflow-hidden border-[rgba(125,211,252,0.08)] bg-[rgba(255,255,255,0.02)] p-2 sm:p-4 lg:p-5">
              <SlotMarketplace />
            </Card>
          </Section>
        ) : (
          <EventsDiscoveryWorkspace
            basePath={appRoutes.play}
            fixedParams={{ mode: "events" }}
            clearHref={modeLinks.events}
            title="Find a match near you."
            description="Pick a date, use the map if you need it, and open the match that fits your time and budget."
          />
        )}
      </Stack>
    </PageShell>
  );
}
