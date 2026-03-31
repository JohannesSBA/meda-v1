import { redirect } from "next/navigation";
import { appRoutes, searchParamsToQueryString } from "@/lib/navigation";

type LegacyEventsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventsPage({ searchParams }: LegacyEventsPageProps) {
  const resolved = await searchParams;
  const params = new URLSearchParams(searchParamsToQueryString(resolved));
  params.set("mode", "events");
  redirect(`${appRoutes.play}?${params.toString()}`);
}
