import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/users/approvals — list pending users for admin approval
export async function GET() {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  const session = raw ? decodeSession(raw) : null;
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can view approvals." },
      { status: 403 },
    );
  }

  // Get user's company
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

  const pendingUsers = await prisma.user.findMany({
    where: {
      verified: true,
      approvalStatus: "pending",
      companyId: user.companyId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      requestedRole: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(pendingUsers);
}

// POST /api/users/approvals — approve or reject a user
export async function POST(req: Request) {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  const session = raw ? decodeSession(raw) : null;
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can approve users." },
      { status: 403 },
    );
  }

  const { userId, action } = await req.json();
  if (!userId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Get user's company
  const adminUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { companyId: true },
  });

  if (!adminUser?.companyId) {
    return NextResponse.json(
      { error: "You must be associated with a company." },
      { status: 400 },
    );
  }

  // Verify the user to approve/reject belongs to the same company
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, approvalStatus: true, requestedRole: true },
  });

  if (!targetUser || targetUser.companyId !== adminUser.companyId) {
    return NextResponse.json(
      { error: "User not found or not in your company." },
      { status: 404 },
    );
  }

  if (targetUser.approvalStatus !== "pending") {
    return NextResponse.json(
      { error: "User is not pending approval." },
      { status: 400 },
    );
  }

  // Update approval status
  const newStatus = action === "approve" ? "approved" : "rejected";
  await prisma.user.update({
    where: { id: userId },
    data: {
      approvalStatus: newStatus,
      role:
        action === "approve"
          ? targetUser.requestedRole || "employee"
          : "employee",
    },
  });

  // If approving a manager, add them to all teams in the company
  if (action === "approve" && targetUser.requestedRole === "manager") {
    const companyTeams = await prisma.team.findMany({
      where: { companyId: adminUser.companyId },
      select: { id: true },
    });

    for (const team of companyTeams) {
      await prisma.teamMember
        .create({
          data: { teamId: team.id, userId },
        })
        .catch(() => {}); // Ignore if already a member
    }
  }

  return NextResponse.json({ success: true, status: newStatus });
}
