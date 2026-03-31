import { redirect } from "next/navigation";
import { appRoutes, searchParamsToQueryString } from "@/lib/navigation";

export const dynamic = "force-dynamic";

type LegacySlotsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SlotsPage({ searchParams }: LegacySlotsPageProps) {
  const resolved = await searchParams;
  const params = new URLSearchParams(searchParamsToQueryString(resolved));
  params.set("mode", "slots");
  redirect(`${appRoutes.play}?${params.toString()}`);
}
