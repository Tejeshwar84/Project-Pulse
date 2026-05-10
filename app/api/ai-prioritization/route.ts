import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface TaskData {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
}

interface PrioritizedTask {
  taskId: string;
  priorityScore: number;
  reason: string;
}

function calculatePriorityScore(task: TaskData): number {
  let score = 0;

  // Deadline-based scoring (higher score = higher priority)
  if (task.dueDate) {
    const daysUntilDue = Math.ceil(
      (task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilDue < 0) {
      score += 100; // Overdue = highest priority
    } else if (daysUntilDue <= 1) {
      score += 80; // Due tomorrow
    } else if (daysUntilDue <= 3) {
      score += 60; // Due within 3 days
    } else if (daysUntilDue <= 7) {
      score += 40; // Due within a week
    } else if (daysUntilDue <= 14) {
      score += 20; // Due within 2 weeks
    }
  }

  // Priority-based scoring
  switch (task.priority) {
    case "high":
      score += 30;
      break;
    case "medium":
      score += 15;
      break;
    case "low":
      score += 5;
      break;
  }

  // Status-based scoring
  switch (task.status) {
    case "blocked":
      score += 50; // Blocked tasks need immediate attention
      break;
    case "in-progress":
      score += 25; // Active tasks get priority
      break;
    case "pending-review":
      score += 20; // Review tasks are important
      break;
    case "todo":
      score += 10; // New tasks get some priority
      break;
    case "done":
      score += 0; // Completed tasks get no priority
      break;
  }

  return Math.min(100, Math.max(0, score));
}

function fallbackPrioritization(tasks: TaskData[]): PrioritizedTask[] {
  return tasks
    .map((task) => ({
      taskId: task.id,
      priorityScore: calculatePriorityScore(task),
      reason: generateFallbackReason(task),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore); // Sort by score descending
}

function generateFallbackReason(task: TaskData): string {
  const reasons: string[] = [];

  // Deadline reason
  if (task.dueDate) {
    const daysUntilDue = Math.ceil(
      (task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilDue < 0) {
      reasons.push("overdue");
    } else if (daysUntilDue <= 1) {
      reasons.push("due tomorrow");
    } else if (daysUntilDue <= 3) {
      reasons.push("due within 3 days");
    } else if (daysUntilDue <= 7) {
      reasons.push("due within a week");
    }
  } else {
    reasons.push("no deadline");
  }

  // Priority reason
  if (task.priority !== "medium") {
    reasons.push(`${task.priority} priority`);
  }

  // Status reason
  if (task.status === "blocked") {
    reasons.push("blocked");
  } else if (task.status === "in-progress") {
    reasons.push("in progress");
  }

  return reasons.length > 0 ? reasons.join(", ") : "standard priority";
}

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );
    }

    // Fetch project tasks with required fields
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const tasks = project.tasks as TaskData[];

    if (tasks.length === 0) {
      return NextResponse.json({ prioritizedTasks: [] });
    }

    // Prepare task data for AI analysis
    const taskSummaries = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString().split("T")[0] || null,
    }));

    const prompt = `Rank these tasks based on urgency and importance.

Tasks data:
${JSON.stringify(taskSummaries, null, 2)}

Consider:
- deadlines (overdue = highest priority, soon = high priority)
- task priority (high > medium > low)
- status (blocked = highest priority, in-progress = high priority, done = lowest priority)
- task dependencies or blocking relationships

Return ONLY valid JSON array of objects with format:
[{"taskId": "task-id", "priorityScore": 85, "reason": "overdue, high priority, blocked"}, ...]

Priority score should be 0-100 where higher numbers indicate higher priority.
Sort the array by priorityScore descending (highest priority first).

No other text or formatting.`;

    try {
      // Try Mistral API
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) throw new Error("No API key");

      const response = await fetch(
        "https://api.mistral.ai/v1/chat/completions",
        {
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
        },
      );

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
      const validatedTasks: PrioritizedTask[] = parsedResponse.map((item) => ({
        taskId: item.taskId,
        priorityScore: Math.min(
          100,
          Math.max(0, parseInt(item.priorityScore) || 0),
        ),
        reason: item.reason || "Analysis unavailable",
      }));

      return NextResponse.json({ prioritizedTasks: validatedTasks });
    } catch (aiError) {
      console.log(
        "AI prioritization failed, using rule-based fallback:",
        aiError,
      );

      // Fallback: rule-based prioritization
      const fallbackTasks = fallbackPrioritization(tasks);

      return NextResponse.json({ prioritizedTasks: fallbackTasks });
    }
  } catch (error) {
    console.error("AI prioritization error:", error);
    return NextResponse.json(
      { error: "Failed to prioritize tasks" },
      { status: 500 },
    );
  }
}
