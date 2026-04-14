/**
 * Root layout -- wraps all pages with fonts, AuthProviders, and HeaderNav/Footer.
 */

import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { getMetadataBaseUrl } from "@/lib/env";
import "./globals.css";
import AuthProviders from "./components/AuthProviders";
import Footer from "./components/Footer";

const METADATA_BASE = getMetadataBaseUrl();

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
  themeColor: "#07111a",
};

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE),
  title: "Meda - Event Management System",
  other: { "color-scheme": "dark" },
  description:
    "Organize pickup matches, split the pitch cost per player, and lock in games near you. Built for Ethiopia’s night football and weekend runs.",
  icons: {
    icon: [
      { url: "/logo-White.svg", type: "image/svg+xml" },
      { url: "/logo.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/logo-White.svg",
    apple: "/logo.png",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Meda - Event Management System",
    description:
      "Organize pickup matches, split the pitch cost per player, and lock in games near you. Built for Ethiopia's night football and weekend runs.",
    images: [{ url: "/logo.png", alt: "Meda" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Script
          id="force-dark-mode"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.style.colorScheme='dark';document.documentElement.classList.add('dark');`,
          }}
        />
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
