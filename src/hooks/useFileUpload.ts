import { useState } from 'react'
import { useMutation } from 'convex/react'

import { api } from '../../convex/_generated/api'
import type { UploadContentCategory, UploadState } from '@/types/uploads'
import { extractMetadata } from '@/utils/metadataExtraction'
import { validateFile, validateImage } from '@/utils/uploadValidation'

type UploadResult = {
  uploadId: string
  storageId: string
  url: string
}

export function useFileUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  })

  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl)
  const saveUpload = useMutation(api.uploads.saveUpload)

  const uploadFile = async (
    file: File,
    category: UploadContentCategory,
  ): Promise<UploadResult> => {
    try {
      setUploadState({ status: 'uploading', progress: 0 })

      // Validate file
      const validation =
        category === 'image'
          ? await validateImage(file)
          : validateFile(file, category)

      if (!validation.valid) {
        throw new Error(validation.error)
      }

      // Generate upload URL
      setUploadState({ status: 'uploading', progress: 10 })
      const uploadUrl = await generateUploadUrl()

      // Upload file
      setUploadState({ status: 'uploading', progress: 30 })
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadResponse.ok) {
        throw new Error('Upload failed')
      }

      const { storageId } = await uploadResponse.json()
      setUploadState({ status: 'processing', progress: 70 })

      // Extract metadata
      const metadata = await extractMetadata(file, category)

      // Save to database
      setUploadState({ status: 'processing', progress: 90 })
      const saveResult = await saveUpload({
        storageId,
        fileName: metadata.fileName,
        fileType: metadata.fileType,
        fileSize: metadata.fileSize,
        contentCategory: metadata.contentCategory,
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
      })

      setUploadState({ status: 'completed', progress: 100 })

      return {
        uploadId: saveResult.uploadId as string,
        storageId,
        url: saveResult.url || '',
      }
    } catch (error) {
      setUploadState({
        status: 'error',
        progress: 0,
        errorMessage:
          error instanceof Error ? error.message : 'Upload failed',
      })
      throw error
    }
  }

  const reset = () => {
    setUploadState({ status: 'idle', progress: 0 })
  }

  return {
    uploadFile,
    uploadState,
    reset,
  }
}
