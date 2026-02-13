import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minus,
  Plus,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PdfViewerProps {
  url: string
  className?: string
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
const DEFAULT_ZOOM_INDEX = 2 // 100%

export default function PdfViewer({ url, className = '' }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [pageInput, setPageInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const zoom = ZOOM_STEPS[zoomIndex]

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error)
    setError('Failed to load PDF')
    setLoading(false)
  }

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1))
  }

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(numPages, prev + 1))
  }

  const handlePageInputSubmit = () => {
    const p = parseInt(pageInput, 10)
    if (!isNaN(p) && p >= 1 && p <= numPages) {
      setPageNumber(p)
    }
    setPageInput('')
  }

  const zoomIn = () => {
    setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))
  }

  const zoomOut = () => {
    setZoomIndex((i) => Math.max(0, i - 1))
  }

  const resetZoom = () => {
    setZoomIndex(DEFAULT_ZOOM_INDEX)
  }

  const openFullscreen = () => {
    setFullscreen(true)
    setZoomIndex(DEFAULT_ZOOM_INDEX)
  }

  const closeFullscreen = () => {
    setFullscreen(false)
    setZoomIndex(DEFAULT_ZOOM_INDEX)
  }

  // Keyboard shortcuts in fullscreen
  useEffect(() => {
    if (!fullscreen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFullscreen()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPrevPage()
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToNextPage()
      if ((e.key === '=' || e.key === '+') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        zoomIn()
      }
      if (e.key === '-' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        zoomOut()
      }
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        resetZoom()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fullscreen, numPages])

  // Scroll to top when page changes in fullscreen
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pageNumber])

  const handleDownload = useCallback(() => {
    const a = document.createElement('a')
    a.href = url
    a.download = 'document.pdf'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }, [url])

  if (error) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    )
  }

  // Inline preview (shown inside BlockNode)
  const inlineView = (
    <div className={`flex flex-col ${className}`}>
      <Document
        file={url}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="flex items-center justify-center p-8">
            <div className="text-zinc-400 text-sm">Loading PDF...</div>
          </div>
        }
      >
        <Page
          pageNumber={pageNumber}
          width={280}
          className="nodrag"
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>

      {!loading && numPages > 0 && (
        <div className="flex items-center justify-between px-2 py-1.5 bg-zinc-800/50 rounded-b-xl">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="p-1 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors nodrag"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-400">
              {pageNumber} / {numPages}
            </span>
            <button
              onClick={openFullscreen}
              className="p-1 rounded hover:bg-zinc-700 transition-colors nodrag"
              title="Open fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>

          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="p-1 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors nodrag"
          >
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      )}
    </div>
  )

  // Fullscreen overlay
  const fullscreenView = fullscreen
    ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex flex-col bg-zinc-950/95 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeFullscreen()
          }}
        >
          {/* Top toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800/60">
            {/* Left: page nav */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
                className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4 text-zinc-300" />
              </button>

              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <input
                  type="text"
                  value={pageInput || pageNumber}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={handlePageInputSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePageInputSubmit()
                  }}
                  onFocus={() => setPageInput(String(pageNumber))}
                  className="w-10 text-center text-xs bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-zinc-300 outline-none focus:border-zinc-500"
                />
                <span>of {numPages}</span>
              </div>

              <button
                onClick={goToNextPage}
                disabled={pageNumber >= numPages}
                className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4 text-zinc-300" />
              </button>
            </div>

            {/* Center: zoom controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={zoomOut}
                disabled={zoomIndex <= 0}
                className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Zoom out"
              >
                <Minus className="w-4 h-4 text-zinc-300" />
              </button>

              <button
                onClick={resetZoom}
                className="px-2 py-0.5 rounded-md hover:bg-zinc-800 transition-colors text-xs text-zinc-300 min-w-[48px] text-center"
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>

              <button
                onClick={zoomIn}
                disabled={zoomIndex >= ZOOM_STEPS.length - 1}
                className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Zoom in"
              >
                <Plus className="w-4 h-4 text-zinc-300" />
              </button>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleDownload}
                className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
                title="Download PDF"
              >
                <Download className="w-4 h-4 text-zinc-300" />
              </button>
              <button
                onClick={closeFullscreen}
                className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
                title="Close (Esc)"
              >
                <X className="w-4 h-4 text-zinc-300" />
              </button>
            </div>
          </div>

          {/* PDF content area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto flex justify-center py-6"
          >
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center h-full">
                  <div className="text-zinc-400 text-sm">Loading PDF...</div>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={zoom}
                className="shadow-2xl shadow-black/50"
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>

          {/* Bottom bar: keyboard hints */}
          <div className="flex items-center justify-center gap-4 px-4 py-1.5 bg-zinc-900/80 border-t border-zinc-800/60">
            <span className="text-[10px] text-zinc-600">
              Arrow keys to navigate
            </span>
            <span className="text-[10px] text-zinc-700">|</span>
            <span className="text-[10px] text-zinc-600">
              Ctrl +/- to zoom
            </span>
            <span className="text-[10px] text-zinc-700">|</span>
            <span className="text-[10px] text-zinc-600">Esc to close</span>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      {inlineView}
      {fullscreenView}
    </>
  )
}
