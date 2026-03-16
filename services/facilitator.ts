import { getAuthUserByEmail, getAuthUserEmails } from "@/lib/auth/userLookup";
import { prisma } from "@/lib/prisma";

export async function listFacilitatorsForPitchOwner(pitchOwnerUserId: string) {
  const facilitators = await prisma.facilitator.findMany({
    where: { pitchOwnerUserId },
    orderBy: { createdAt: "desc" },
  });
  const authUsers = await getAuthUserEmails(
    facilitators.map((facilitator) => facilitator.facilitatorUserId),
  );

  return facilitators.map((facilitator) => {
    const authUser = authUsers.get(facilitator.facilitatorUserId);
    return {
      id: facilitator.id,
      facilitatorUserId: facilitator.facilitatorUserId,
      pitchOwnerUserId: facilitator.pitchOwnerUserId,
      isActive: facilitator.isActive,
      createdAt: facilitator.createdAt.toISOString(),
      updatedAt: facilitator.updatedAt.toISOString(),
      name: authUser?.name ?? authUser?.email ?? "Unknown",
      email: authUser?.email ?? "",
    };
  });
}

export async function createFacilitator(args: {
  pitchOwnerUserId: string;
  email: string;
}) {
  const authUser = await getAuthUserByEmail(args.email);
  if (!authUser?.id) {
    throw new Error("No account found for that email");
  }
  if (authUser.id === args.pitchOwnerUserId) {
    throw new Error("You cannot add yourself as a facilitator");
  }

  const existing = await prisma.facilitator.findUnique({
    where: { facilitatorUserId: authUser.id },
  });
  if (existing && existing.pitchOwnerUserId !== args.pitchOwnerUserId) {
    throw new Error("This user is already assigned to another pitch owner");
  }

  const facilitator = existing
    ? await prisma.facilitator.update({
        where: { facilitatorUserId: authUser.id },
        data: {
          isActive: true,
          pitchOwnerUserId: args.pitchOwnerUserId,
        },
      })
    : await prisma.facilitator.create({
        data: {
          facilitatorUserId: authUser.id,
          pitchOwnerUserId: args.pitchOwnerUserId,
        },
      });

  return {
    id: facilitator.id,
    facilitatorUserId: facilitator.facilitatorUserId,
    pitchOwnerUserId: facilitator.pitchOwnerUserId,
    isActive: facilitator.isActive,
    createdAt: facilitator.createdAt.toISOString(),
    updatedAt: facilitator.updatedAt.toISOString(),
    name: authUser.name ?? authUser.email ?? "Unknown",
    email: authUser.email ?? "",
  };
}

export async function updateFacilitator(args: {
  id: string;
  pitchOwnerUserId: string;
  isActive: boolean;
}) {
  const facilitator = await prisma.facilitator.findFirst({
    where: {
      id: args.id,
      pitchOwnerUserId: args.pitchOwnerUserId,
    },
  });
  if (!facilitator) {
    throw new Error("Facilitator not found");
  }

  const updated = await prisma.facilitator.update({
    where: { id: args.id },
    data: {
      isActive: args.isActive,
    },
  });
  const authUsers = await getAuthUserEmails([updated.facilitatorUserId]);
  const authUser = authUsers.get(updated.facilitatorUserId);

  return {
    id: updated.id,
    facilitatorUserId: updated.facilitatorUserId,
    pitchOwnerUserId: updated.pitchOwnerUserId,
    isActive: updated.isActive,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    name: authUser?.name ?? authUser?.email ?? "Unknown",
    email: authUser?.email ?? "",
  };
}
