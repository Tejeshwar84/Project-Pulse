import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, decodeSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// List all employees (verified users) for the add-member dropdown
export async function GET() {
    const raw = cookies().get(SESSION_COOKIE)?.value
    const session = raw ? decodeSession(raw) : null
    if (!session || session.role === 'employee') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get user's company
    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { companyId: true },
    })

    if (!user?.companyId) {
        return NextResponse.json({ error: 'You must be associated with a company.' }, { status: 400 })
    }

    const users = await prisma.user.findMany({
        where: { verified: true, companyId: user.companyId },
        select: { id: true, name: true, email: true, role: true, approvalStatus: true, requestedRole: true },
        orderBy: { name: 'asc' },
    })
    return NextResponse.json(users)
}
