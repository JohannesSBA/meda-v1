/**
 * Root layout -- wraps all pages with fonts, AuthProviders, and HeaderNav/Footer.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getAppBaseUrl } from "@/lib/env";
import "./globals.css";
import AuthProviders from "./components/AuthProviders";
import Footer from "./components/Footer";

const BASE_URL = getAppBaseUrl();

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased `}
      >
        <AuthProviders>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1 min-w-0">{children}</div>
            <Footer />
          </div>
        </AuthProviders>
      </body>
    </html>
  );
}
