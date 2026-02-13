import { Upload } from 'lucide-react'
import { useRef } from 'react'
import { useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { UploadContentCategory } from '@/types/uploads'
import { useFileUpload } from '@/hooks/useFileUpload'

interface UploadButtonProps {
  contentType: UploadContentCategory
  onUploadComplete: (uploadId: string, url: string, metadata?: any) => void
  className?: string
  children?: React.ReactNode
}

export default function UploadButton({
  contentType,
  onUploadComplete,
  className = '',
  children,
}: UploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadFile, uploadState } = useFileUpload()

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const result = await uploadFile(file, contentType)

      // Get the storage URL
      const url = await fetch(
        `/api/uploads/${result.storageId}/url`,
      ).then((r) => r.json())

      onUploadComplete(result.uploadId, url || '', {
        fileName: file.name,
        fileSize: file.size,
      })
    } catch (error) {
      console.error('Upload failed:', error)
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const isUploading = uploadState.status === 'uploading' ||
    uploadState.status === 'processing'

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isUploading}
        className={`group flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {children || (
          <>
            <Upload className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" />
            <span className="text-sm text-zinc-300">
              {isUploading
                ? `Uploading... ${uploadState.progress}%`
                : `Upload ${contentType}`}
            </span>
          </>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptString(contentType)}
        onChange={handleFileChange}
        className="hidden"
      />

      {uploadState.status === 'error' && uploadState.errorMessage && (
        <div className="text-xs text-red-400 mt-1">
          {uploadState.errorMessage}
        </div>
      )}
    </>
  )
}

function getAcceptString(contentType: UploadContentCategory): string {
  switch (contentType) {
    case 'image':
      return 'image/jpeg,image/png,image/webp,image/gif'
    case 'audio':
      return 'audio/mpeg,audio/wav,audio/ogg,audio/mp4'
    case 'video':
      return 'video/mp4,video/webm,video/quicktime'
    case 'pdf':
      return 'application/pdf'
    default:
      return '*/*'
  }
}
