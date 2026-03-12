/**
 * ProfileHeader -- Avatar, name, email, balance, and admin badge for profile page.
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/cn";
import { Cluster } from "@/app/components/ui/primitives";
import type { ProfileUser } from "./types";

type ProfileHeaderProps = {
  user: ProfileUser;
  isAdmin: boolean;
  balance: number;
  avatarUrl: string;
};

export function ProfileHeader({ user, isAdmin, balance, avatarUrl }: ProfileHeaderProps) {
  return (
    <Card className="overflow-hidden p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <Image
          src={avatarUrl}
          alt={`${user.name} profile`}
          width={112}
          height={112}
          className="h-24 w-24 rounded-[28px] border border-[var(--color-border-strong)] object-cover shadow-[0_16px_36px_rgba(2,6,23,0.18)] sm:h-28 sm:w-28"
        />

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="heading-kicker">{isAdmin ? "Admin workspace" : "Player profile"}</p>
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--color-text-primary)] sm:text-4xl">
                {user.name}
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] sm:text-base">{user.email}</p>
            </div>
          </div>

          <Cluster gap="sm">
            {isAdmin ? <Badge variant="accent">Admin access</Badge> : <Badge variant="default">Community member</Badge>}
            {!isAdmin ? (
              <Badge variant={balance > 0 ? "accent" : "default"}>
                Balance: ETB {balance.toFixed(2)}
              </Badge>
            ) : null}
          </Cluster>
        </div>

        <Cluster gap="sm" className="lg:justify-end">
          {!isAdmin ? (
            <Link href="/events" className={cn(buttonVariants("secondary", "md"), "rounded-full")}>
              Browse events
            </Link>
          ) : null}
          <Link href="/my-tickets" className={cn(buttonVariants("primary", "md"), "rounded-full")}>
            My tickets
          </Link>
        </Cluster>
      </div>
    </Card>
  );
}
