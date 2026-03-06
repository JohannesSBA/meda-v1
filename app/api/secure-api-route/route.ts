import { auth } from "@/lib/auth/server";

export async function GET() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id, email, name, role } = session.user as {
    id: string;
    email?: string;
    name?: string;
    role?: string;
  };

  return Response.json({ user: { id, email, name, role } });
}
