import { AccountView } from "@neondatabase/auth/react";
import { accountViewPaths } from "@neondatabase/auth/react/ui/server";
import { Card } from "@/app/components/ui/card";
import { PageShell } from "@/app/components/ui/page-shell";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(accountViewPaths).map((path) => ({ path }));
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <PageShell containerClassName="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl items-start justify-center px-4 py-10">
      <Card className="w-full p-4 md:p-6">
        <AccountView path={path} />
      </Card>
    </PageShell>
  );
}
