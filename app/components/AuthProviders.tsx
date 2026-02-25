"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { Toaster } from "sonner";
import { authClient } from "@/lib/auth/client";
import HeaderNav from "./HeaderNav";

type SessionPayload = ReturnType<typeof authClient.useSession>["data"];
type NeonUIAuthClient = React.ComponentProps<
  typeof NeonAuthUIProvider
>["authClient"];

type AuthProvidersProps = {
  children: React.ReactNode;
  initialSession?: unknown | null;
};

export default function AuthProviders({
  children,
  initialSession = null,
}: AuthProvidersProps) {
  return (
    <NeonAuthUIProvider
      authClient={authClient as unknown as NeonUIAuthClient}
      redirectTo="/events"
      social={{
        providers: ["google"],
      }}
    >
      <HeaderNav initialSession={initialSession as SessionPayload | null} />
      {children}
      <Toaster position="top-center" theme="dark" />
    </NeonAuthUIProvider>
  );
}
