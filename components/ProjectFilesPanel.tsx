"use client"

import { useRef, useState, type ChangeEvent } from "react"

interface Attachment {
  id: string
  originalFileName: string
  fileSize: number
  mimeType: string
  createdAt: string
  uploadedByName: string
  downloadUrl: string
}

interface ProjectFilesPanelProps {
  projectId: string
  initialFiles: Attachment[]
}

const FILE_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".txt",
  ".csv",
  ".zip",
].join(",")

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

const fileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return '🖼️'
  if (ext === 'pdf') return '📄'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx'].includes(ext)) return '📊'
  if (['ppt', 'pptx'].includes(ext)) return '📈'
  if (ext === 'zip') return '🗜️'
  return '📎'
}

export default function ProjectFilesPanel({ projectId, initialFiles }: ProjectFilesPanelProps) {
  const [files, setFiles] = useState<Attachment[]>(initialFiles)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileSelect = async (file: File) => {
    setUploading(true)
    setStatus('idle')
    setMessage('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', projectId)

    try {
      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Upload failed')
      }

      const result = await res.json()
      setFiles((prev) => [
        {
          id: result.id,
          originalFileName: result.originalFileName,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
          createdAt: result.createdAt,
          uploadedByName: result.uploadedByName,
          downloadUrl: result.downloadUrl,
        },
        ...prev,
      ])
      setStatus('success')
      setMessage('File uploaded successfully.')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await handleFileSelect(file)
    event.target.value = ''
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    const file = event.dataTransfer.files?.[0]
    if (file) await handleFileSelect(file)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = () => {
    setDragActive(false)
  }

  return (
    <div className="glass rounded-3xl border border-white/10 p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Files & Reports</h2>
          <p className="text-sm text-white/50">Upload and download project attachments securely.</p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-light"
        >
          Upload file
        </button>
      </div>

      <div
        className={`min-h-[140px] rounded-3xl border border-dashed p-4 transition ${dragActive ? 'border-accent text-white/90 bg-white/5' : 'border-white/10 bg-white/5'} `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_ACCEPT}
          className="hidden"
          onChange={handleInputChange}
        />
        <div className="flex min-h-[80px] flex-col items-center justify-center gap-2 text-center text-sm text-white/60">
          <p className="font-medium text-white">Drag & drop your file here or click the upload button.</p>
          <p>Supported: PDF, DOCX, images, ZIP</p>
          {uploading && <p className="text-accent-light">Uploading...</p>}
        </div>
      </div>

      {status !== 'idle' && (
        <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${status === 'success' ? 'bg-jade/10 text-jade' : 'bg-rose/10 text-rose'}`} role="status">
          {message}
        </div>
      )}

      <div className="mt-6 max-h-[360px] overflow-y-auto rounded-3xl border border-white/10 bg-surface-1 p-4">
        {files.length === 0 ? (
          <div className="py-16 text-center text-sm text-white/50">No files uploaded yet.</div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-lg">
                    {fileIcon(file.originalFileName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{file.originalFileName}</p>
                    <p className="text-[11px] text-white/50">
                      {file.uploadedByName} · {new Date(file.createdAt).toLocaleDateString()} · {formatBytes(file.fileSize)}
                    </p>
                  </div>
                </div>
                <a
                  href={file.downloadUrl}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:border-accent hover:text-accent"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
