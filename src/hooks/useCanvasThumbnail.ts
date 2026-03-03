import { useCallback, useRef } from 'react'
import { toJpeg } from 'html-to-image'
import { useMutation } from 'convex/react'

import { api } from '../../convex/_generated/api'

import type { Id } from '../../convex/_generated/dataModel'

const THUMBNAIL_WIDTH = 800
const THUMBNAIL_QUALITY = 0.7
const MIN_CAPTURE_INTERVAL_MS = 30_000

export function useCanvasThumbnail(projectId: Id<'projects'>) {
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl)
  const saveThumbnail = useMutation(api.projects.saveThumbnail)
  const lastCaptureRef = useRef(0)
  const capturingRef = useRef(false)

  const capture = useCallback(async () => {
    if (capturingRef.current) return
    if (Date.now() - lastCaptureRef.current < MIN_CAPTURE_INTERVAL_MS) return

    const el = document.querySelector('.react-flow') as HTMLElement | null
    if (!el) return

    capturingRef.current = true

    try {
      const dataUrl = await toJpeg(el, {
        quality: THUMBNAIL_QUALITY,
        width: THUMBNAIL_WIDTH,
        height: Math.round(
          THUMBNAIL_WIDTH * (el.offsetHeight / el.offsetWidth),
        ),
        skipFonts: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
        filter: (node) => {
          // Skip UI overlays (controls, panels, sidebar) from the screenshot
          if (node instanceof HTMLElement) {
            const cls = node.className ?? ''
            if (
              typeof cls === 'string' &&
              (cls.includes('react-flow__controls') ||
                cls.includes('react-flow__panel'))
            ) {
              return false
            }
          }
          return true
        },
      })

      // Convert data URL to blob
      const res = await fetch(dataUrl)
      const blob = await res.blob()

      // Upload to Convex storage
      const uploadUrl = await generateUploadUrl()
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': blob.type },
        body: blob,
      })

      if (!uploadRes.ok) return

      const { storageId } = (await uploadRes.json()) as { storageId: string }

      // Save reference on project
      await saveThumbnail({ id: projectId, storageId })

      lastCaptureRef.current = Date.now()
    } catch {
      // Thumbnail capture is best-effort — don't break the app
    } finally {
      capturingRef.current = false
    }
  }, [projectId, generateUploadUrl, saveThumbnail])

  return { capture }
}
