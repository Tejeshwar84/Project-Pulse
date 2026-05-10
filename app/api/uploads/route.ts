import fs from 'fs'
import path from 'path'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, decodeSession } from '@/lib/auth'
import {
  generateFileName,
  getStoragePath,
  validateFileExtension,
  validateMimeType,
  MAX_UPLOAD_SIZE,
  sanitizeFileName,
} from '@/lib/file-upload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status })

async function getCompanyId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  })
  return user?.companyId ?? null
}

async function validateProjectOwnership(projectId: string, companyId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { select: { companyId: true } } },
  })

  return !!project && project.team?.companyId === companyId
}

async function validateTaskOwnership(taskId: string, companyId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: { include: { team: { select: { companyId: true } } } } },
  })

  return !!task && task.project.team?.companyId === companyId
}

export async function POST(req: Request) {
  const raw = cookies().get(SESSION_COOKIE)?.value
  const session = raw ? decodeSession(raw) : null

  if (!session) {
    return jsonError('Authentication required.', 401)
  }

  const companyId = await getCompanyId(session.userId)
  if (!companyId) {
    return jsonError('Authenticated user must belong to a company.', 403)
  }

  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return jsonError('multipart/form-data required.', 400)
  }

  const formData = await req.formData()
  const files = formData.getAll('file')
  if (files.length !== 1) {
    return jsonError('Exactly one file must be uploaded.', 400)
  }

  const file = files[0]
  if (!(file instanceof File)) {
    return jsonError('Invalid file upload.', 400)
  }

  const originalFileName = sanitizeFileName(file.name)
  if (!originalFileName) {
    return jsonError('Invalid file name.', 400)
  }

  const extension = path.extname(originalFileName).toLowerCase()
  if (!validateFileExtension(extension)) {
    return jsonError('File type is not permitted.', 400)
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return jsonError('File size must be 10MB or less.', 413)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_UPLOAD_SIZE) {
    return jsonError('File size must be 10MB or less.', 413)
  }

  const mimeType = file.type || 'application/octet-stream'
  if (!validateMimeType(mimeType, extension, buffer)) {
    return jsonError('Invalid file mime type or extension.', 400)
  }

  const projectId = formData.get('projectId')?.toString() || null
  const taskId = formData.get('taskId')?.toString() || null

  if (projectId && !(await validateProjectOwnership(projectId, companyId))) {
    return jsonError('Project does not belong to your company.', 403)
  }

  if (taskId && !(await validateTaskOwnership(taskId, companyId))) {
    return jsonError('Task does not belong to your company.', 403)
  }

  if (projectId && taskId) {
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (task?.projectId !== projectId) {
      return jsonError('Task does not belong to the provided project.', 400)
    }
  }

  const storageDir = getStoragePath(companyId)
  await fs.promises.mkdir(storageDir, { recursive: true })

  const generatedFileName = generateFileName(originalFileName)
  const storageFilePath = path.join(storageDir, generatedFileName)
  await fs.promises.writeFile(storageFilePath, buffer)

  const relativeFilePath = path.posix.join('uploads', companyId, generatedFileName)
  const attachment = await prisma.fileAttachment.create({
    data: {
      originalFileName,
      generatedFileName,
      filePath: relativeFilePath,
      fileSize: buffer.length,
      mimeType,
      uploadedById: session.userId,
      projectId,
      taskId,
    },
  })

  return NextResponse.json(
    {
      id: attachment.id,
      originalFileName: attachment.originalFileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      projectId: attachment.projectId,
      taskId: attachment.taskId,
      uploadedByName: session.name,
      downloadUrl: `/api/uploads/${attachment.id}`,
      createdAt: attachment.createdAt,
    },
    { status: 201 },
  )
}
