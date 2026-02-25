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
  title: "Meda - Event Management System",
  description:
    "Organize pickup matches, split the pitch cost per player, and lock in games near you. Built for Ethiopia’s night football and weekend runs.",
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "Meda - Event Management System",
    description:
      "A Next.js application with Neon Auth - Meda Event Management System",
    images: "/logo.png",
  },
  twitter: {
    card: "summary_large_image",
  },
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
    <html lang="en" className="dark" suppressHydrationWarning>
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
