import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, decodeSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function getSession() {
    const raw = cookies().get(SESSION_COOKIE)?.value
    return raw ? decodeSession(raw) : null
}

// GET /api/teams — public for registration form; authenticated users get member details
export async function GET() {
    const session = getSession()

    if (session) {
        // Authenticated: return teams from user's company only
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { companyId: true },
        })

        if (!user?.companyId) {
            return NextResponse.json([])
        }

        const teams = await prisma.team.findMany({
            where: { companyId: user.companyId },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true, role: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })
        return NextResponse.json(teams)
    }

    // Unauthenticated (registration form): return minimal list - but should this be filtered?
    // For now, keep showing all companies for registration, but this might need to change
    const teams = await prisma.team.findMany({
        select: { id: true, name: true, description: true },
        orderBy: { name: 'asc' },
    })
    return NextResponse.json(teams)
}

// POST /api/teams — create a new team (admin/manager only)
export async function POST(req: Request) {
    const session = getSession()
    if (!session || session.role === 'employee') {
        return NextResponse.json({ error: 'Only admins and managers can create teams.' }, { status: 403 })
    }

    const { name, description } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Team name is required.' }, { status: 400 })

    // Get user's company
    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { companyId: true },
    })

    if (!user?.companyId) {
        return NextResponse.json({ error: 'You must be associated with a company to create teams.' }, { status: 400 })
    }

    const team = await prisma.team.create({
        data: {
            name: name.trim(),
            description: description?.trim() || null,
            createdBy: session.userId,
            companyId: user.companyId,
        },
        include: { members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } } },
    })
    return NextResponse.json(team, { status: 201 })
}
