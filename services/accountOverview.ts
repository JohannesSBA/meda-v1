import { prisma } from "@/lib/prisma";
import { normalizeAppUserRole, type SessionUser } from "@/lib/auth/roles";

export type AccountWorkspaceOverview = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: ReturnType<typeof normalizeAppUserRole>;
    authRole: string | null;
    parentPitchOwnerUserId: string | null;
  };
  stats: {
    balanceEtb: number;
    upcomingHeldTickets: number;
    upcomingSharedTickets: number;
    upcomingManagedEvents: number;
  };
};

export async function getAccountWorkspaceOverview(
  user: SessionUser,
): Promise<AccountWorkspaceOverview> {
  const normalizedRole = normalizeAppUserRole(user.role);
  const now = new Date();
  const managedEventOwnerId =
    normalizedRole === "facilitator"
      ? user.parentPitchOwnerUserId ?? null
      : user.id;

  const [
    balanceRecord,
    upcomingHeldTickets,
    upcomingSharedTickets,
    upcomingManagedEvents,
  ] = await Promise.all([
    prisma.userBalance.findUnique({
      where: { userId: user.id },
      select: { balanceEtb: true },
    }),
    prisma.eventAttendee.count({
      where: {
        userId: user.id,
        event: {
          eventDatetime: { gte: now },
        },
      },
    }),
    prisma.eventAttendee.count({
      where: {
        purchaserUserId: user.id,
        userId: { not: user.id },
        event: {
          eventDatetime: { gte: now },
        },
      },
    }),
    managedEventOwnerId
      ? prisma.event.count({
          where: {
            userId: managedEventOwnerId,
            eventDatetime: { gte: now },
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      role: normalizedRole,
      authRole: user.authRole ?? user.role ?? null,
      parentPitchOwnerUserId: user.parentPitchOwnerUserId ?? null,
    },
    stats: {
      balanceEtb: Number(balanceRecord?.balanceEtb ?? 0),
      upcomingHeldTickets,
      upcomingSharedTickets,
      upcomingManagedEvents,
    },
  };
}
