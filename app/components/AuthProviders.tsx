/**
 * AuthProviders -- wraps app with NeonAuthUIProvider and Toaster.
 *
 * Provides auth context and shared client-side chrome.
 */

"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { Toaster } from "sonner";
import { authClient } from "@/lib/auth/client";
import HeaderNav from "./HeaderNav";
type NeonUIAuthClient = React.ComponentProps<
  typeof NeonAuthUIProvider
>["authClient"];

type AuthProvidersProps = {
  children: React.ReactNode;
};

export default function AuthProviders({ children }: AuthProvidersProps) {
  return (
    <NeonAuthUIProvider
      authClient={authClient as unknown as NeonUIAuthClient}
      redirectTo="/events"
      className="bg-black"
      social={{
        providers: ["google"],
      }}
    >
      <HeaderNav />
      {children}
      <Toaster position="top-center" theme="dark" />
    </NeonAuthUIProvider>
  );
}
