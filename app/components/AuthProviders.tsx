"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth/client";
import HeaderNav from "./HeaderNav";

type SessionPayload = ReturnType<typeof authClient.useSession>["data"];
type NeonUIAuthClient = React.ComponentProps<typeof NeonAuthUIProvider>["authClient"];

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
      redirectTo="/account/settings"
      emailOTP
      social={{
        providers: ["google"],
      }}
      credentials={{ forgotPassword: true }}
    >
      <HeaderNav initialSession={initialSession as SessionPayload | null} />
      {children}
    </NeonAuthUIProvider>
  );
}
