import fs from 'fs'
import path from 'path'

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.txt',
  '.csv',
  '.zip',
])

const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.sh',
  '.cmd',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.jar',
  '.dll',
  '.so',
  '.com',
  '.scr',
  '.vbs',
  '.ps1',
  '.php',
])

const MIME_TYPE_BY_EXTENSION: Record<string, readonly string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword', 'application/vnd.ms-office'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
  '.xls': ['application/vnd.ms-excel', 'application/x-tar', 'application/x-ole-storage'],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
  '.ppt': [
    'application/vnd.ms-powerpoint',
    'application/x-ole-storage',
  ],
  '.pptx': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
  ],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'application/csv'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
}

const ALLOWED_MIME_TYPES = new Set<string>(
  Object.values(MIME_TYPE_BY_EXTENSION).flat(),
)

export function getStoragePath(companyId: string) {
  return path.join(process.cwd(), 'public', 'uploads', companyId)
}

export function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '') || 'file'
}

export function getFileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase()
}

export function validateFileExtension(extension: string) {
  if (!extension) {
    return false
  }
  if (DANGEROUS_EXTENSIONS.has(extension)) {
    return false
  }
  return ALLOWED_EXTENSIONS.has(extension)
}

export function generateFileName(originalName: string) {
  const extension = getFileExtension(originalName)
  const timestamp = Date.now()
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${timestamp}-${suffix}${extension}`
}

export function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 4) {
    if (buffer.slice(0, 4).equals(Buffer.from([0x25, 0x50, 0x44, 0x46]))) {
      return 'application/pdf'
    }
    if (buffer.slice(0, 4).equals(Buffer.from([0xff, 0xd8, 0xff, 0xdb])) || buffer.slice(0, 4).equals(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))) {
      return 'image/jpeg'
    }
    if (buffer.slice(0, 4).equals(Buffer.from('GIF8'))) {
      return 'image/gif'
    }
    if (buffer.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
      return 'image/png'
    }
    if (buffer.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      return 'application/zip'
    }
    if (buffer.slice(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) {
      return 'application/x-ole-storage'
    }
  }
  return null
}

export function validateMimeType(
  mimeType: string,
  extension: string,
  buffer: Buffer,
) {
  if (!validateFileExtension(extension)) {
    return false
  }
  if (!mimeType || mimeType === 'application/octet-stream') {
    return false
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return false
  }

  const detected = detectMimeType(buffer)
  if (!detected) {
    return ['.txt', '.csv'].includes(extension)
  }

  if (extension === '.txt' || extension === '.csv') {
    return true
  }

  if (['.zip', '.docx', '.xlsx', '.pptx'].includes(extension)) {
    return detected === 'application/zip'
  }

  if (['.doc', '.xls', '.ppt'].includes(extension)) {
    return detected === 'application/x-ole-storage'
  }

  if (extension === '.pdf') {
    return detected === 'application/pdf'
  }

  if (['.png', '.jpg', '.jpeg', '.gif'].includes(extension)) {
    return detected === mimeType
  }

  return false
}

export async function deleteFileFromStorage(filePath: string) {
  return fs.promises.unlink(filePath).catch(() => undefined)
}
