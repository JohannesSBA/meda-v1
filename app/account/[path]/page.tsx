/**
 * Account pages -- Meda account workspace for settings/security and Neon fallback elsewhere.
 */

import { redirect } from "next/navigation";
import { AccountView } from "@neondatabase/auth/react";
import { accountViewPaths } from "@neondatabase/auth/react/ui/server";
import { AccountWorkspace } from "@/app/components/account/AccountWorkspace";
import { Card } from "@/app/components/ui/card";
import { PageShell } from "@/app/components/ui/page-shell";
import { normalizeAppUserRole, type SessionUser } from "@/lib/auth/roles";
import { auth } from "@/lib/auth/server";
import { getAccountWorkspaceOverview } from "@/services/accountOverview";

const knownAccountPaths = new Set(Object.values(accountViewPaths));

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  if (!knownAccountPaths.has(path as (typeof accountViewPaths)[keyof typeof accountViewPaths])) {
    redirect("/profile");
  }

  if (path === accountViewPaths.SETTINGS || path === accountViewPaths.SECURITY) {
    const section = path === accountViewPaths.SETTINGS ? "settings" : "security";
    const { data } = await auth.getSession();
    const rawUser = (data?.user ?? null) as SessionUser | null;

    if (!rawUser) {
      redirect(`/auth/sign-in?redirect=/account/${path}`);
    }

    const overview = await getAccountWorkspaceOverview({
      ...rawUser,
      role: normalizeAppUserRole(rawUser.role),
    });

    return (
      <PageShell containerClassName="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <AccountWorkspace
          section={section}
          overview={overview}
        />
      </PageShell>
    );
  }

  return (
    <PageShell containerClassName="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl items-start justify-center px-4 py-10">
      <Card className="w-full p-4 md:p-6">
        <AccountView path={path} />
      </Card>
    </PageShell>
  );
}
