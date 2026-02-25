"use client";

import { Card } from "@/app/components/ui/card";
import { PageShell } from "@/app/components/ui/page-shell";
import { authClient } from "@/lib/auth/client";

export default function ClientRenderedPage() {
  const { data } = authClient.useSession();

  return (
    <PageShell containerClassName="mx-auto max-w-3xl px-4 py-10">
      <Card className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Client Rendered Page</h1>

        <p className="muted-copy">
          Authenticated:{" "}
          <span className={data?.session ? "text-green-400" : "text-red-300"}>
            {data?.session ? "Yes" : "No"}
          </span>
        </p>

        {data?.user && <p className="muted-copy">User ID: {data.user.id}</p>}

        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          Session and User Data:
        </p>

        <pre className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-text-secondary)]">
          {JSON.stringify({ session: data?.session, user: data?.user }, null, 2)}
        </pre>
      </Card>
    </PageShell>
  );
}