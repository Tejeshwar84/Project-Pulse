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
    return NextResponse.json({ error: "No company associated" }, { status: 400 });
  }

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Upcoming meetings
  const upcomingMeetings = await prisma.meeting.findMany({
    where: {
      companyId: user.companyId,
      dateTime: {
        gte: now,
        lte: nextWeek,
      },
      participants: {
        some: {
          userId: session.userId,
        },
      },
    },
    select: {
      id: true,
      title: true,
      dateTime: true,
    },
    orderBy: { dateTime: "asc" },
  });

  // Upcoming task deadlines
  const upcomingTasks = await prisma.task.findMany({
    where: {
      project: {
        team: {
          companyId: user.companyId,
        },
      },
      assigneeId: session.userId,
      dueDate: {
        gte: now,
        lte: nextWeek,
      },
      status: {
        not: "done",
      },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      project: {
        select: { name: true },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // Overdue tasks
  const overdueTasks = await prisma.task.findMany({
    where: {
      project: {
        team: {
          companyId: user.companyId,
        },
      },
      assigneeId: session.userId,
      dueDate: {
        lt: now,
      },
      status: {
        not: "done",
      },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      project: {
        select: { name: true },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const alerts = {
    upcomingMeetings,
    upcomingTasks,
    overdueTasks,
  };

  return NextResponse.json(alerts);
}