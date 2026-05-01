import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const meetings = await prisma.meeting.findMany({
    where: { companyId: user.companyId },
    include: {
      creator: { select: { name: true, id: true } },
      participants: { include: { user: { select: { name: true, id: true } } } },
    },
    orderBy: { dateTime: "asc" },
  });

  const meetingsWithPermissions = meetings.map((meeting) => ({
    ...meeting,
    canEdit:
      meeting.createdBy === session.userId ||
      session.role === "admin" ||
      session.role === "manager",
  }));

  return NextResponse.json(meetingsWithPermissions);
}

export async function POST(req: Request) {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  const session = raw ? decodeSession(raw) : null;
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json(
      { error: "Only admins and managers can create meetings." },
      { status: 403 },
    );
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
  const { title, description, dateTime, participantIds } = body;

  if (!title || !dateTime) {
    return NextResponse.json(
      { error: "Title and dateTime are required" },
      { status: 400 },
    );
  }

  const meeting = await prisma.meeting.create({
    data: {
      title,
      description,
      dateTime: new Date(dateTime),
      createdBy: session.userId,
      companyId: user.companyId,
      participants: {
        create: participantIds?.map((userId: string) => ({ userId })) || [],
      },
    },
    include: {
      creator: { select: { name: true } },
      participants: { include: { user: { select: { name: true } } } },
    },
  });

  return NextResponse.json(meeting);
}
