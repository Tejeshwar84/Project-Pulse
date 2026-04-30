import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await prisma.project.findMany({ include: { tasks: true } });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  // Only admins and managers can create projects
  const raw = cookies().get(SESSION_COOKIE)?.value;
  const session = raw ? decodeSession(raw) : null;
  if (!session || session.role === "employee") {
    return NextResponse.json(
      { error: "Only admins and managers can create projects." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { teamId, currency, ...projectData } = body;

  // If teamId is provided, validate it belongs to user's company
  if (teamId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { companyId: true },
    });

    if (!user?.companyId) {
      return NextResponse.json(
        {
          error:
            "You must be associated with a company to assign teams to projects.",
        },
        { status: 400 },
      );
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { companyId: true },
    });

    if (!team || team.companyId !== user.companyId) {
      return NextResponse.json(
        { error: "You can only assign teams from your company to projects." },
        { status: 400 },
      );
    }
  }

  const project = await prisma.project.create({
    data: {
      ...projectData,
      teamId: teamId || null,
      currency: currency || "USD",
    },
  });
  return NextResponse.json(project);
}

// PUT - Update existing project (including team assignment)
export async function PUT(req: Request) {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  const session = raw ? decodeSession(raw) : null;
  if (!session || session.role === "employee") {
    return NextResponse.json(
      { error: "Only admins and managers can update projects." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { projectId, teamId, ...updateData } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required." },
      { status: 400 },
    );
  }

  // Validate project exists and user has access
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { select: { companyId: true } } },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { companyId: true },
  });

  if (!user?.companyId) {
    return NextResponse.json(
      { error: "You must be associated with a company." },
      { status: 400 },
    );
  }

  // If project has a team, user must be from that team's company
  // If project has no team, user must be from some company in this system
  if (project.team && project.team.companyId !== user.companyId) {
    return NextResponse.json(
      { error: "You can only update projects from your company." },
      { status: 403 },
    );
  }

  // If assigning a new team, validate it belongs to user's company
  if (teamId !== undefined && teamId !== null) {
    const newTeam = await prisma.team.findUnique({
      where: { id: teamId },
      select: { companyId: true },
    });

    if (!newTeam || newTeam.companyId !== user.companyId) {
      return NextResponse.json(
        { error: "You can only assign teams from your company to projects." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...updateData,
      ...(teamId !== undefined && { teamId: teamId || null }),
    },
  });

  return NextResponse.json(updated);
}
