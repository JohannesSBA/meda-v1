import { PageShell } from "@/app/components/ui/page-shell";
import { CreateEventStatusPanel } from "@/app/components/create-event/CreateEventStatusPanel";

export default async function CreateEventStatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const txRefParam =
    params.tx_ref ??
    params.txRef ??
    params.reference ??
    params["amp;tx_ref"] ??
    params["amp%3Btx_ref"];

  const txRef =
    typeof txRefParam === "string" && txRefParam.trim()
      ? txRefParam.trim()
      : null;

  return (
    <PageShell containerClassName="mx-auto flex min-h-[70vh] max-w-4xl items-center">
      <CreateEventStatusPanel txRef={txRef} />
    </PageShell>
  );
}
