import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/auth/guards";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdminUser();
  if (adminCheck.response) return adminCheck.response;
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { eventId: id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.event.delete({ where: { eventId: id } });
  return NextResponse.json({ ok: true });
}
