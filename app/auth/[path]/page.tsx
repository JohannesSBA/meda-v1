import { AuthView } from "@neondatabase/auth/react";
import { PageShell } from "@/app/components/ui/page-shell";
import { Card } from "@/app/components/ui/card";

export const dynamicParams = false;

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <PageShell containerClassName="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center px-4 py-10">
      <Card className="w-full p-4 md:p-6">
        <AuthView path={path} />
      </Card>
    </PageShell>
  );
}
