import { PageShell } from "@/app/components/ui/page-shell";
import { ChapaStatusPanel } from "@/app/components/payments/ChapaStatusPanel";

export default async function ChapaStatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventIdParam = params.eventId;
  const txRefParam =
    params.tx_ref ?? params.txRef ?? params.reference;

  const eventId =
    typeof eventIdParam === "string" && eventIdParam.trim()
      ? eventIdParam.trim()
      : null;
  const txRef =
    typeof txRefParam === "string" && txRefParam.trim()
      ? txRefParam.trim()
      : null;

  return (
    <PageShell containerClassName="mx-auto flex min-h-[70vh] max-w-4xl items-center px-4 py-10 sm:px-6">
      <ChapaStatusPanel eventId={eventId} txRef={txRef} />
    </PageShell>
  );
}
