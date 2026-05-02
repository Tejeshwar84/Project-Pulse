import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface WorkloadUser {
  userId: string;
  userName: string;
  taskCount: number;
  highPriorityCount: number;
  status: "overloaded" | "balanced" | "underutilized";
}

interface WorkloadSuggestion {
  taskId: string;
  fromUserId: string;
  toUserId: string;
  reason: string;
}

interface TaskData {
  id: string;
  title: string;
  priority: string;
  status: string;
  assigneeId: string | null;
}

interface ProjectUser {
  id: string;
  name: string;
}

function getFallbackStatus(taskCount: number, highPriorityCount: number): WorkloadUser["status"] {
  if (taskCount > 5 || highPriorityCount > 2) {
    return "overloaded";
  }
  if (taskCount < 3) {
    return "underutilized";
  }
  return "balanced";
}

function getPriorityWeight(priority: string): number {
  switch (priority) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function buildFallbackSuggestions(users: WorkloadUser[], tasks: TaskData[]): WorkloadSuggestion[] {
  const overloadedUsers = users.filter(user => user.status === "overloaded");
  const underutilizedUsers = users.filter(user => user.status === "underutilized");
  const suggestions: WorkloadSuggestion[] = [];

  if (overloadedUsers.length === 0 || underutilizedUsers.length === 0) {
    return suggestions;
  }

  const tasksByUser = new Map<string, TaskData[]>();
  users.forEach(user => tasksByUser.set(user.userId, []));
  tasks.forEach(task => {
    if (task.assigneeId && tasksByUser.has(task.assigneeId)) {
      tasksByUser.get(task.assigneeId)?.push(task);
    }
  });

  const sortedUnderutilized = [...underutilizedUsers].sort((a, b) => a.taskCount - b.taskCount);

  for (const overloaded of overloadedUsers) {
    const candidateTasks = (tasksByUser.get(overloaded.userId) || []).sort((a, b) => {
      const weightA = getPriorityWeight(a.priority);
      const weightB = getPriorityWeight(b.priority);
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return a.title.localeCompare(b.title);
    });

    for (const task of candidateTasks) {
      const targetUser = sortedUnderutilized.shift();
      if (!targetUser) break;

      suggestions.push({
        taskId: task.id,
        fromUserId: overloaded.userId,
        toUserId: targetUser.userId,
        reason: `Move ${task.priority} priority task to balance workload with ${targetUser.userName}`,
      });

      sortedUnderutilized.push(targetUser);
      sortedUnderutilized.sort((a, b) => a.taskCount - b.taskCount);
      if (suggestions.length >= 5) break;
    }

    if (suggestions.length >= 5) {
      break;
    }
  }

  return suggestions;
}

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            priority: true,
            status: true,
            assigneeId: true,
          },
        },
        team: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const taskData = project.tasks as TaskData[];
    const teamUsers = project.team?.members.map(member => member.user) ?? [];
    const assigneeIds = new Set(taskData.filter(task => task.assigneeId).map(task => task.assigneeId as string));

    const allUsers = teamUsers.reduce<Record<string, ProjectUser>>((acc, user) => {
      acc[user.id] = { id: user.id, name: user.name };
      return acc;
    }, {});

    for (const task of taskData) {
      if (task.assigneeId && !allUsers[task.assigneeId]) {
        const assignee = await prisma.user.findUnique({
          where: { id: task.assigneeId },
          select: { id: true, name: true },
        });
        if (assignee) {
          allUsers[assignee.id] = { id: assignee.id, name: assignee.name };
        }
      }
    }

    const users = Object.values(allUsers).map(user => {
      const userTasks = taskData.filter(task => task.assigneeId === user.id);
      const highPriorityCount = userTasks.filter(task => task.priority === "high").length;
      return {
        userId: user.id,
        userName: user.name,
        taskCount: userTasks.length,
        highPriorityCount,
        status: getFallbackStatus(userTasks.length, highPriorityCount),
      } as WorkloadUser;
    });

    const taskSummaries = taskData.map(task => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      assigneeId: task.assigneeId,
    }));

    const userSummaries = users.map(user => ({
      userId: user.userId,
      userName: user.userName,
      taskCount: user.taskCount,
      highPriorityCount: user.highPriorityCount,
      status: user.status,
    }));

    const prompt = `Analyze workload distribution across the team.

Users:
${JSON.stringify(userSummaries, null, 2)}

Tasks:
${JSON.stringify(taskSummaries, null, 2)}

Return:
- overloaded users
- underutilized users
- suggested task reassignment for balance

Return ONLY valid JSON with this structure:
{
  "users": [
    { "userId": "id", "userName": "name", "taskCount": 5, "highPriorityCount": 2, "status": "overloaded" }
  ],
  "suggestions": [
    { "taskId": "task-id", "fromUserId": "user-id", "toUserId": "user-id", "reason": "reason" }
  ]
}

Avoid any extra text or formatting.`;

    try {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) throw new Error("No API key");

      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;
      if (!aiResponse) throw new Error("No AI response");

      const parsed = JSON.parse(aiResponse.trim());
      if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.suggestions)) {
        throw new Error("Invalid response format");
      }

      const validatedUsers = parsed.users.map((item: any) => ({
        userId: item.userId,
        userName: item.userName,
        taskCount: Number.isFinite(item.taskCount) ? item.taskCount : parseInt(item.taskCount) || 0,
        highPriorityCount: Number.isFinite(item.highPriorityCount) ? item.highPriorityCount : parseInt(item.highPriorityCount) || 0,
        status: item.status === "overloaded" || item.status === "balanced" || item.status === "underutilized" ? item.status : getFallbackStatus(item.taskCount, item.highPriorityCount),
      } as WorkloadUser));

      const validatedSuggestions = parsed.suggestions.map((item: any) => ({
        taskId: item.taskId,
        fromUserId: item.fromUserId,
        toUserId: item.toUserId,
        reason: item.reason || "Suggested reassignment",
      } as WorkloadSuggestion));

      return NextResponse.json({ users: validatedUsers, suggestions: validatedSuggestions });
    } catch (aiError) {
      console.log("AI workload optimization failed, using fallback:", aiError);
      const suggestions = buildFallbackSuggestions(users, taskData);
      return NextResponse.json({ users, suggestions });
    }
  } catch (error) {
    console.error("AI workload optimization error:", error);
    return NextResponse.json({ error: "Failed to optimize workload" }, { status: 500 });
  }
}
