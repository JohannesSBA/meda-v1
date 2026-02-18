import { authClient } from '@/lib/auth/client';
import { auth } from '@/lib/auth/server';
import { NeonAuthUIProvider } from '@neondatabase/auth/react';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import HeaderNav from './components/HeaderNav';

type SessionPayload = ReturnType<typeof authClient.useSession>["data"];


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'My Neon App',
  description: 'A Next.js application with Neon Auth',
};

type NeonUIAuthClient = React.ComponentProps<typeof NeonAuthUIProvider>['authClient'];

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data: initialSession } = await auth.getSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NeonAuthUIProvider
          authClient={authClient as unknown as NeonUIAuthClient}
          redirectTo="/account/settings"
          emailOTP
          social={{  
            providers: ['google']  
          }} 
          credentials={{ forgotPassword: true }} 
        >
          <HeaderNav initialSession={initialSession as SessionPayload} />
          {children}
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}
