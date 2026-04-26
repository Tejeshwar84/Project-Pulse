import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, decodeSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const projects = await prisma.project.findMany({ include: { tasks: true } })
  return NextResponse.json(projects)
}

export async function POST(req: Request) {
  // Only admins and managers can create projects
  const raw = cookies().get(SESSION_COOKIE)?.value
  const session = raw ? decodeSession(raw) : null
  if (!session || session.role === 'employee') {
    return NextResponse.json({ error: 'Only admins and managers can create projects.' }, { status: 403 })
  }

  const body = await req.json()
  const { teamId, ...projectData } = body

  // If teamId is provided, validate it belongs to user's company
  if (teamId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { companyId: true },
    })

    if (!user?.companyId) {
      return NextResponse.json({ error: 'You must be associated with a company to assign teams to projects.' }, { status: 400 })
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { companyId: true },
    })

    if (!team || team.companyId !== user.companyId) {
      return NextResponse.json({ error: 'You can only assign teams from your company to projects.' }, { status: 400 })
    }
  }

  const project = await prisma.project.create({
    data: { ...projectData, teamId: teamId || null }
  })
  return NextResponse.json(project)
}

