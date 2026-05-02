import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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

  const body = await req.json();
  const { amount, description, projectId } = body;

  if (!amount || !description || !projectId) {
    return NextResponse.json(
      { error: "Amount, description, and projectId are required" },
      { status: 400 },
    );
  }

  // Verify project belongs to user's company
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { team: { select: { companyId: true } } },
  });

  if (!project || project.team?.companyId !== user.companyId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const expense = await prisma.expense.create({
    data: {
      amount,
      description,
      projectId,
      createdBy: session.userId,
      companyId: user.companyId,
    },
    include: {
      creator: { select: { name: true } },
    },
  });

  // Update project spent amount
  await prisma.project.update({
    where: { id: projectId },
    data: {
      spent: {
        increment: amount,
      },
    },
  });

  return NextResponse.json(expense);
}
