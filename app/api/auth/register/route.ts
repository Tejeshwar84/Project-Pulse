import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registerUser } from '@/lib/db-auth';
import type { Role } from '@/lib/db-auth';

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    try {
        const { name, email, password, role, companyId, companyName, companyDescription } = await req.json();

        if (!name?.trim() || !email?.trim() || !password) {
            return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
        }

        const validRoles: Role[] = ['admin', 'manager', 'employee'];
        const resolvedRole: Role = validRoles.includes(role) ? role : 'employee';

        const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        if (existingUser) {
            return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
        }

        let assignedCompanyId: string | undefined;
        let approvalStatus = 'pending';

        if (resolvedRole === 'admin') {
            if (!companyName?.trim()) {
                return NextResponse.json({ error: 'Company name is required for admin signup.' }, { status: 400 });
            }

            const company = await prisma.company.create({
                data: {
                    name: companyName.trim(),
                    description: companyDescription?.trim() || null,
                },
            });
            assignedCompanyId = company.id;
            approvalStatus = 'approved';
        } else {
            if (!companyId) {
                return NextResponse.json({ error: 'Please select a company to join.' }, { status: 400 });
            }

            const company = await prisma.company.findUnique({ where: { id: companyId } });
            if (!company) {
                return NextResponse.json({ error: 'Selected company does not exist.' }, { status: 400 });
            }

            assignedCompanyId = company.id;
            approvalStatus = 'pending';
        }

        const { email: userEmail } = await registerUser({
            name,
            email,
            password,
            role: resolvedRole,
            companyId: assignedCompanyId,
            approvalStatus,
            requestedRole: resolvedRole,
        });

        return NextResponse.json({ success: true, email: userEmail });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message === 'EMAIL_TAKEN') {
            return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
        }
        console.error('[register]', err);
        return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
    }
}
