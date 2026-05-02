import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface TaskData {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  assignee: { id: string; name: string } | null;
}

interface TaskRisk {
  taskId: string;
  riskScore: number;
  reason: string;
}

function calculateTaskRisk(task: TaskData, workloadByUser: Map<string, number>): TaskRisk {
  let riskScore = 0;
  const reasons: string[] = [];

  // Deadline proximity risk
  if (task.dueDate) {
    const daysUntilDue = Math.ceil((task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      riskScore += 100;
      reasons.push("overdue");
    } else if (daysUntilDue <= 1) {
      riskScore += 80;
      reasons.push("due tomorrow");
    } else if (daysUntilDue <= 3) {
      riskScore += 60;
      reasons.push("due within 3 days");
    } else if (daysUntilDue <= 7) {
      riskScore += 30;
      reasons.push("due within a week");
    }
  } else {
    riskScore += 20;
    reasons.push("no deadline set");
  }

  // Status-based risk
  switch (task.status) {
    case "blocked":
      riskScore += 70;
      reasons.push("task is blocked");
      break;
    case "todo":
      riskScore += 40;
      reasons.push("not yet started");
      break;
    case "in-progress":
      riskScore += 20;
      reasons.push("in progress");
      break;
    case "pending-review":
      riskScore += 10;
      reasons.push("awaiting review");
      break;
    case "done":
      riskScore = 0;
      reasons.push("completed");
      break;
  }

  // Priority-based risk
  if (task.priority === "high") {
    riskScore += 20;
    reasons.push("high priority");
  } else if (task.priority === "medium") {
    riskScore += 10;
    reasons.push("medium priority");
  }

  // Workload-based risk
  if (task.assignee) {
    const userWorkload = workloadByUser.get(task.assignee.id) || 0;
    if (userWorkload > 5) {
      riskScore += 30;
      reasons.push(`assignee has ${userWorkload} tasks`);
    } else if (userWorkload > 3) {
      riskScore += 15;
      reasons.push(`assignee has ${userWorkload} tasks`);
    }
  } else {
    riskScore += 25;
    reasons.push("unassigned");
  }

  return {
    taskId: task.id,
    riskScore: Math.min(100, Math.max(0, riskScore)),
    reason: reasons.join(", "),
  };
}

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Fetch project and tasks
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const tasks = project.tasks as TaskData[];

    // Calculate workload per user
    const workloadByUser = new Map<string, number>();
    tasks.forEach(task => {
      if (task.assignee) {
        const current = workloadByUser.get(task.assignee.id) || 0;
        workloadByUser.set(task.assignee.id, current + 1);
      }
    });

    // Prepare task data for AI analysis
    const taskSummaries = tasks.map(task => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString().split('T')[0] || null,
      assignee: task.assignee?.name || "Unassigned",
      workload: task.assignee ? workloadByUser.get(task.assignee.id) || 0 : 0
    }));

    const prompt = `Analyze each task and return delay risk percentage (0-100) with reason.

Tasks data:
${JSON.stringify(taskSummaries, null, 2)}

Consider:
- deadline proximity (overdue = high risk, soon = medium risk)
- task status (blocked = high risk, todo = medium risk, done = low risk)
- assigned user workload (high workload = higher risk)
- priority level (high priority = higher risk)

Return ONLY valid JSON array of objects with format:
[{"taskId": "task-id", "riskScore": 85, "reason": "overdue, high priority, assignee overloaded"}, ...]

No other text or formatting.`;

    try {
      // Try Mistral API
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
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;

      if (!aiResponse) throw new Error("No AI response");

      // Parse AI response as JSON
      const parsedResponse = JSON.parse(aiResponse.trim());

      if (!Array.isArray(parsedResponse)) {
        throw new Error("Invalid response format");
      }

      // Validate and sanitize response
      const validatedTasks: TaskRisk[] = parsedResponse.map(item => ({
        taskId: item.taskId,
        riskScore: Math.min(100, Math.max(0, parseInt(item.riskScore) || 0)),
        reason: item.reason || "Analysis unavailable"
      }));

      return NextResponse.json({ tasks: validatedTasks });

    } catch (aiError) {
      console.log("AI analysis failed, using rule-based fallback:", aiError);

      // Fallback: rule-based analysis
      const fallbackTasks: TaskRisk[] = tasks.map(task =>
        calculateTaskRisk(task, workloadByUser)
      );

      return NextResponse.json({ tasks: fallbackTasks });
    }

  } catch (error) {
    console.error("AI delay risk analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze delay risk" },
      { status: 500 }
    );
  }
}