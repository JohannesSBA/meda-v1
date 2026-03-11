/**
 * Auth pages -- sign-in, sign-up, and password reset via Neon Auth.
 */

import { AuthView } from "@neondatabase/auth/react";
import { PageShell } from "@/app/components/ui/page-shell";

export const dynamicParams = false;

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <PageShell containerClassName="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center px-4 py-10">
      <AuthView path={path} className="dark" />
    </PageShell>
  );
}
