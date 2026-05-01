import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  const session = raw ? decodeSession(raw) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todo = await prisma.todo.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });

  if (!todo || todo.userId !== session.userId) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  const body = await req.json();
  const { title, completed, dueDate } = body;

  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (completed !== undefined) updateData.completed = completed;
  if (dueDate !== undefined)
    updateData.dueDate = dueDate ? new Date(dueDate) : null;

  const updatedTodo = await prisma.todo.update({
    where: { id: params.id },
    data: updateData,
  });

  return NextResponse.json(updatedTodo);
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  const session = raw ? decodeSession(raw) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todo = await prisma.todo.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });

  if (!todo || todo.userId !== session.userId) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  await prisma.todo.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
