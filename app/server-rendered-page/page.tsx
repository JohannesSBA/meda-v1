import { Card } from "@/app/components/ui/card";
import { PageShell } from "@/app/components/ui/page-shell";
import { auth } from "@/lib/auth/server";

// Server components using auth methods must be rendered dynamically
export const dynamic = "force-dynamic";

export default async function ServerRenderedPage() {
  const { data: session } = await auth.getSession();

  return (
    <PageShell containerClassName="mx-auto max-w-3xl px-4 py-10">
      <Card className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Server Rendered Page</h1>

        <p className="muted-copy">
          Authenticated:{" "}
          <span className={session ? "text-green-400" : "text-red-300"}>
            {session ? "Yes" : "No"}
          </span>
        </p>

        {session?.user && (
          <p className="muted-copy">User ID: {session.user.id}</p>
        )}

        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          Session and User Data:
        </p>

        <pre className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-text-secondary)]">
          {JSON.stringify(
            { session: session?.session, user: session?.user },
            null,
            2,
          )}
        </pre>
      </Card>
    </PageShell>
  );
}