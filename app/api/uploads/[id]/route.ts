import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, decodeSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status })

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const raw = cookies().get(SESSION_COOKIE)?.value
  const session = raw ? decodeSession(raw) : null

  if (!session) {
    return jsonError('Authentication required.', 401)
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { companyId: true },
  })

  if (!user?.companyId) {
    return jsonError('Authenticated user must belong to a company.', 403)
  }

  const attachment = await prisma.fileAttachment.findUnique({
    where: { id: params.id },
    include: {
      uploadedBy: { select: { companyId: true } },
      project: { include: { team: { select: { companyId: true } } } },
      task: { include: { project: { include: { team: { select: { companyId: true } } } } } },
    },
  })

  if (!attachment) {
    return jsonError('File not found.', 404)
  }

  if (attachment.uploadedBy.companyId !== user.companyId) {
    return jsonError('Forbidden.', 403)
  }

  if (attachment.project && attachment.project.team?.companyId !== user.companyId) {
    return jsonError('Forbidden.', 403)
  }

  if (
    attachment.task &&
    attachment.task.project.team?.companyId !== user.companyId
  ) {
    return jsonError('Forbidden.', 403)
  }

  const absoluteFilePath = path.join(
    process.cwd(),
    'public',
    ...attachment.filePath.split('/'),
  )

  if (!fs.existsSync(absoluteFilePath)) {
    return jsonError('File not found on disk.', 404)
  }

  const stream = Readable.toWeb(fs.createReadStream(absoluteFilePath))
  const safeFileName = attachment.originalFileName.replace(/"/g, '')

  return new NextResponse(stream as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename="${safeFileName}"`,
    },
  })
}
