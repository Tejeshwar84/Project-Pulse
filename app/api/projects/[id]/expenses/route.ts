import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  const session = raw ? decodeSession(raw) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { companyId: true },
  });

  if (!user?.companyId) {
    return NextResponse.json(
      { error: "No company associated" },
      { status: 400 },
    );
  }

  // Verify project belongs to user's company
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { team: { select: { companyId: true } } },
  });

  if (!project || project.team?.companyId !== user.companyId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const expenses = await prisma.expense.findMany({
    where: { projectId: params.id },
    include: {
      creator: { select: { name: true, id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(expenses);
}
