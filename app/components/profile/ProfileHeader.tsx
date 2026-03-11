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
import type { ProfileUser } from "./types";

type ProfileHeaderProps = {
  user: ProfileUser;
  isAdmin: boolean;
  balance: number;
  avatarUrl: string;
};

export function ProfileHeader({
  user,
  isAdmin,
  balance,
  avatarUrl,
}: ProfileHeaderProps) {
  return (
    <Card className="rounded-2xl bg-gradient-to-br from-[#0f2235]/80 via-[#0c1c2d]/70 to-[#0a1523]/80 p-6 sm:rounded-3xl">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Image
          src={avatarUrl}
          alt={`${user.name} profile`}
          width={96}
          height={96}
          className="h-24 w-24 rounded-full border-2 border-white/15 object-cover"
        />
        <div className="flex-1">
          <p className="text-sm uppercase tracking-widest text-[var(--color-brand)]">
            {isAdmin ? "Admin profile" : "My profile"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
            {user.name}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{user.email}</p>
          {!isAdmin && balance > 0 ? (
            <p className="mt-1 text-sm font-semibold text-[var(--color-brand)]">
              Meda Balance: ETB {balance.toFixed(2)}
            </p>
          ) : null}
        </div>
        {isAdmin ? (
          <Badge className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)]">
            Admin
          </Badge>
        ) : (
          <Link
            href="/events"
            className={cn(
              buttonVariants("secondary", "sm"),
              "rounded-full",
            )}
          >
            Browse events
          </Link>
        )}
      </div>
    </Card>
  );
}
