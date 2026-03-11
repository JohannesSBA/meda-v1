import { auth } from "@/lib/auth/server";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProviders from "./components/AuthProviders";
import Footer from "./components/Footer";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://meda.app";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Meda - Event Management System",
  description:
    "Organize pickup matches, split the pitch cost per player, and lock in games near you. Built for Ethiopia’s night football and weekend runs.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Meda - Event Management System",
    description:
      "Organize pickup matches, split the pitch cost per player, and lock in games near you. Built for Ethiopia's night football and weekend runs.",
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
          <div className="flex min-h-screen flex-col">
            <div className="flex-1 min-w-0">{children}</div>
            <Footer />
          </div>
        </AuthProviders>
      </body>
    </html>
  );
}
