import { auth } from "@/lib/auth/server";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProviders from "./components/AuthProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Neon App",
  description: "A Next.js application with Neon Auth",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialSession: unknown | null = null;
  try {
    const { data } = await auth.getSession();
    initialSession = data ?? null;
  } catch (error) {
    // Fail-open: auth issues should not take down the entire app shell.
    console.error("Failed to load auth session in layout", error);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased `}
      >
        <AuthProviders initialSession={initialSession}>
          {children}
        </AuthProviders>
      </body>
    </html>
  );
}
