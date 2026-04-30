import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
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
    return NextResponse.json({ error: "No company associated" }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      creator: { select: { name: true } },
      participants: { include: { user: { select: { name: true, id: true } } } },
    },
  });

  if (!meeting || meeting.companyId !== user.companyId) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  return NextResponse.json(meeting);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
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
    return NextResponse.json({ error: "No company associated" }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    select: { companyId: true, createdBy: true },
  });

  if (!meeting || meeting.companyId !== user.companyId) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Only creator or admin/manager can update
  if (meeting.createdBy !== session.userId && session.role === "employee") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { notes, actionItems, participantIds } = body;

  const updateData: any = {};
  if (notes !== undefined) updateData.notes = notes;
  if (actionItems !== undefined) updateData.actionItems = actionItems;

  if (participantIds) {
    // Delete existing participants and add new ones
    await prisma.meetingParticipant.deleteMany({
      where: { meetingId: params.id },
    });
    updateData.participants = {
      create: participantIds.map((userId: string) => ({ userId })),
    };
  }

  const updatedMeeting = await prisma.meeting.update({
    where: { id: params.id },
    data: updateData,
    include: {
      creator: { select: { name: true } },
      participants: { include: { user: { select: { name: true, id: true } } } },
    },
  });

  return NextResponse.json(updatedMeeting);
}