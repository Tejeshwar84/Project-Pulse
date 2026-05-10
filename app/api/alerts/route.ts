import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type AlertType = "deadline" | "meeting" | "ai";

type AlertSeverity = "high" | "medium" | "low";

interface AlertItem {
  type: AlertType;
  message: string;
  severity: AlertSeverity;
}

function calculateRiskScore(task: {
  dueDate: Date | null;
  status: string;
  priority: string;
}) {
  let score = 0;
  const now = new Date();

  if (task.dueDate) {
    const days = Math.ceil(
      (task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < 0) score += 60;
    else if (days <= 1) score += 40;
    else if (days <= 3) score += 20;
  } else {
    score += 10;
  }

  switch (task.status) {
    case "blocked":
      score += 30;
      break;
    case "todo":
      score += 20;
      break;
    case "in-progress":
      score += 10;
      break;
    case "pending-review":
      score += 5;
      break;
    case "done":
      score -= 50;
      break;
  }

  if (task.priority === "high") score += 20;
  if (task.priority === "medium") score += 10;

  return Math.min(100, Math.max(0, score));
}

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

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: {
      project: {
        team: {
          companyId: user.companyId,
        },
      },
      assigneeId: session.userId,
      status: {
        not: "done",
      },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      status: true,
      priority: true,
      projectId: true,
    },
  });

  console.log(
    `[alerts] fetched ${tasks.length} tasks for user ${session.userId}`,
  );
  tasks.forEach((task) => {
    console.log(
      `[alerts] task ${task.id} dueDate=${task.dueDate ? task.dueDate.toISOString() : "none"}`,
    );
  });

  const meetings = await prisma.meeting.findMany({
    where: {
      companyId: user.companyId,
      participants: {
        some: {
          userId: session.userId,
        },
      },
      dateTime: {
        gte: now,
        lte: in1h,
      },
    },
    select: {
      id: true,
      title: true,
      dateTime: true,
    },
    orderBy: { dateTime: "asc" },
  });

  console.log(
    `[alerts] fetched ${meetings.length} meetings for user ${session.userId}`,
  );
  meetings.forEach((meeting) => {
    console.log(
      `[alerts] meeting ${meeting.id} dateTime=${meeting.dateTime.toISOString()} (within next hour)`,
    );
  });

  const alerts: AlertItem[] = [];

  for (const task of tasks) {
    if (!task.dueDate) {
      console.log(`[alerts] task ${task.id} has no dueDate and is skipped`);
      continue;
    }

    const due = task.dueDate;
    const diffMs = due.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    console.log(
      `[alerts] task ${task.id} due in ${diffMs}ms (${diffHours.toFixed(2)}h)`,
    );

    if (due < now) {
      alerts.push({
        type: "deadline",
        message: `Task "${task.title}" is overdue.`,
        severity: "high",
      });
      continue;
    }

    if (due <= in24h) {
      const hours = Math.max(1, Math.ceil(diffHours));
      alerts.push({
        type: "deadline",
        message: `Task "${task.title}" is due in ${hours} hour${hours === 1 ? "" : "s"}.`,
        severity: hours <= 3 ? "high" : "medium",
      });
    }
  }

  for (const meeting of meetings) {
    alerts.push({
      type: "meeting",
      message: `Meeting "${meeting.title}" starts within the next hour.`,
      severity: "medium",
    });
  }

  const companyTasks = await prisma.task.findMany({
    where: {
      project: {
        team: {
          companyId: user.companyId,
        },
      },
      status: {
        not: "done",
      },
      assigneeId: {
        not: null,
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      assigneeId: true,
    },
  });

  const userWorkloads = new Map<
    string,
    { count: number; highPriority: number; userName: string }
  >();
  for (const task of companyTasks) {
    if (!task.assigneeId) continue;
    const workload = userWorkloads.get(task.assigneeId) ?? {
      count: 0,
      highPriority: 0,
      userName: "",
    };
    workload.count += 1;
    if (task.priority === "high") workload.highPriority += 1;
    userWorkloads.set(task.assigneeId, workload);
  }

  console.log(
    `[alerts] companyTasks=${companyTasks.length} company users with workload=${userWorkloads.size}`,
  );

  const userIds = Array.from(userWorkloads.keys());
  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    for (const userRecord of users) {
      const workload = userWorkloads.get(userRecord.id);
      if (!workload) continue;
      workload.userName = userRecord.name;
      userWorkloads.set(userRecord.id, workload);
    }
  }

  userWorkloads.forEach((workload, assigneeId) => {
    const overloaded = workload.count > 5 || workload.highPriority > 2;
    if (!overloaded) return;

    const isSelf = assigneeId === session.userId;
    const message = isSelf
      ? `You have a heavy workload with ${workload.count} tasks and ${workload.highPriority} high-priority items.`
      : `${workload.userName} has ${workload.count} tasks with ${workload.highPriority} high-priority items.`;

    alerts.push({
      type: "ai",
      message,
      severity: "high",
    });
  });

  for (const task of tasks) {
    const riskScore = calculateRiskScore(task);
    if (riskScore > 70) {
      alerts.push({
        type: "ai",
        message: `Task "${task.title}" is high risk (${riskScore}%).`,
        severity: "medium",
      });
    }
  }

  console.log(`[alerts] returning ${alerts.length} alerts`);
  return NextResponse.json({ alerts });
}
