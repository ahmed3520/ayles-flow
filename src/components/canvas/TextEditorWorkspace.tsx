import {
  Bold,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code,
  Download,
  Heading1,
  Heading2,
  History,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
  SquarePen,
  TextQuote,
  Undo2,
  X,
} from 'lucide-react'
import Placeholder from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core'
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useAction, useMutation, useQuery } from 'convex/react'
import { createPortal } from 'react-dom'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../../../convex/_generated/api'
import AgentPanel from './AgentPanel'
import type { Node } from '@xyflow/react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { NodeViewProps } from '@tiptap/core'
import type { ChangeEvent, ComponentProps, ComponentType } from 'react'
import type {
  ActiveTextEditorState,
  AgentTextEditorBridge,
  EditTextNodeAction,
  FormatTextNodeAction,
} from '@/types/agent'
import type { BlockNodeData } from '@/types/nodes'
import type { TextExportFormat } from '@/utils/textExport'
import { submitToFal } from '@/data/fal'
import { useFileUpload } from '@/hooks/useFileUpload'
import { isHtmlDocument, markdownToRichTextHtml } from '@/utils/nodeTextUtils'
import { exportTextDocument } from '@/utils/textExport'

type ToolbarButtonIconProps = {
  className?: string
  size?: number
  strokeWidth?: number
}

type ToolbarButtonProps = {
  active?: boolean
  disabled?: boolean
  icon: ComponentType<ToolbarButtonIconProps>
  label: string
  onClick: NonNullable<ComponentProps<'button'>['onClick']>
}

type SlashMenuState = {
  query: string
  range: { from: number; to: number }
  x: number
  caretTop: number
  caretBottom: number
}

type SlashCommand = {
  id: string
  label: string
  keywords: string
}

type SelectionMenuState = {
  text: string
  range: { from: number; to: number }
  x: number
  selectionTop: number
  selectionBottom: number
}

type SelectionHelperAction = {
  id: 'summarize' | 'rewrite' | 'shorten' | 'expand' | 'fix'
  label: string
}

type PendingTextHelper = {
  actionLabel: string
  generationId: Id<'generations'>
  range: { from: number; to: number }
  anchorX: number
  anchorTop: number
  anchorBottom: number
}

type PendingMediaGeneration = {
  generationId: Id<'generations'>
  insertPos: number
  prompt: string
}

type TextDocumentVersion = {
  _id: Id<'versions'>
  createdAt: number
  name: string
  previewText: string
  document: string
}

type MediaComposerAnchor = {
  source: 'toolbar' | 'slash-menu' | 'selection-menu'
  x: number
  y: number
  align: 'start' | 'center' | 'end'
}

type SaveStatus = 'saved' | 'saving' | 'unsaved'
type RichTextEditor = NonNullable<ReturnType<typeof useEditor>>
const SELECTION_MENU_DELAY_MS = 180
const AUTO_TEXT_VERSION_IDLE_MS = 45_000
const AUTO_TEXT_VERSION_MIN_GAP_MS = 120_000

type TextEditorWorkspaceProps = {
  agentPanelProps: Omit<
    ComponentProps<typeof AgentPanel>,
    'onClose' | 'variant'
  >
  node: Node<BlockNodeData> | null
  onClose: () => void
  projectId: Id<'projects'>
  onEditorContextChange?: (state: ActiveTextEditorState | null) => void
  onRegisterAgentBridge?: (bridge: AgentTextEditorBridge | null) => void
  onUpdateDocument: (value: string) => void
  saveStatus?: SaveStatus
}

function ToolbarButton({
  active = false,
  disabled = false,
  icon: Icon,
  label,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border transition-colors ${
        active
          ? 'border-zinc-600 bg-zinc-700/80 text-zinc-100'
          : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      } ${disabled ? 'opacity-40' : ''}`}
      onClick={onClick}
      title={label}
      disabled={disabled}
    >
      <Icon size={15} strokeWidth={1.8} />
    </button>
  )
}

function ResizableImageView({
  node,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const [isResizing, setIsResizing] = useState(false)

  const width = typeof node.attrs.width === 'number' ? node.attrs.width : null

  useEffect(() => {
    if (!isResizing) return

    const onPointerMove = (event: PointerEvent) => {
      const delta = event.clientX - startXRef.current
      const nextWidth = Math.max(
        120,
        Math.min(1600, startWidthRef.current + delta),
      )
      updateAttributes({ width: Math.round(nextWidth) })
    }

    const onPointerUp = () => setIsResizing(false)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [isResizing, updateAttributes])

  return (
    <NodeViewWrapper as="div" className="my-6">
      <div
        className={`group relative inline-block max-w-full rounded-sm ${
          selected ? 'ring-2 ring-blue-500/60' : ''
        }`}
      >
        <img
          ref={imageRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          title={node.attrs.title || ''}
          draggable={false}
          className="max-w-full rounded-sm border border-zinc-700"
          style={{
            width: width ? `${width}px` : undefined,
            height: 'auto',
          }}
        />
        <button
          type="button"
          className="absolute right-0 bottom-0 h-3.5 w-3.5 translate-x-1/2 translate-y-1/2 rounded-sm border border-white/50 bg-blue-500 opacity-0 transition-opacity group-hover:opacity-100"
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const currentWidth =
              width ?? imageRef.current?.getBoundingClientRect().width ?? 320

            startXRef.current = event.clientX
            startWidthRef.current = currentWidth
            setIsResizing(true)
          }}
          title="Resize image"
        />
      </div>
    </NodeViewWrapper>
  )
}

const RichImage = TiptapNode.create({
  name: 'image',
  group: 'block',
  inline: false,
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const widthAttr = element.getAttribute('width')
          if (widthAttr) {
            const parsed = parseInt(widthAttr, 10)
            return Number.isFinite(parsed) ? parsed : null
          }
          const styleWidth = element.style.width
          if (styleWidth.endsWith('px')) {
            const parsed = parseInt(styleWidth, 10)
            return Number.isFinite(parsed) ? parsed : null
          }
          return null
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { width, ...attrs } = HTMLAttributes as Record<string, unknown> & {
      width?: number
    }
    const style = width
      ? `width:${width}px;max-width:100%;height:auto;`
      : 'max-width:100%;height:auto;'

    return [
      'img',
      mergeAttributes({ loading: 'lazy', draggable: 'false', style }, attrs),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})

const SLASH_COMMANDS: Array<SlashCommand> = [
  { id: 'heading-1', label: 'Heading 1', keywords: 'h1 title' },
  { id: 'heading-2', label: 'Heading 2', keywords: 'h2 subtitle' },
  { id: 'bold', label: 'Bold', keywords: 'strong emphasis' },
  { id: 'italic', label: 'Italic', keywords: 'emphasis' },
  { id: 'bullet-list', label: 'Bullet list', keywords: 'list ul bullets' },
  { id: 'ordered-list', label: 'Numbered list', keywords: 'list ol numbers' },
  { id: 'quote', label: 'Quote', keywords: 'blockquote' },
  { id: 'code-block', label: 'Code block', keywords: 'code snippet' },
  { id: 'divider', label: 'Divider', keywords: 'hr line separator' },
  {
    id: 'image-generate',
    label: 'Generate image',
    keywords: 'ai image generate media illustration',
  },
  { id: 'image-upload', label: 'Upload image', keywords: 'image photo media' },
]

const SELECTION_HELPER_ACTIONS: Array<SelectionHelperAction> = [
  { id: 'summarize', label: 'Summarize' },
  { id: 'rewrite', label: 'Rewrite' },
  { id: 'shorten', label: 'Shorter' },
  { id: 'expand', label: 'Expand' },
  { id: 'fix', label: 'Fix' },
]

function buildSelectionHelperPrompt(
  action: SelectionHelperAction['id'],
  selectedText: string,
): string {
  const base = `You are editing selected text inside a document. Preserve the original language and return only the replacement text. Do not add explanations, quotes, headings about the task, or code fences.\n\nSelected text:\n"""${selectedText.trim()}"""\n`

  switch (action) {
    case 'summarize':
      return `${base}\nTask: Summarize this selection into a tighter version that keeps the key meaning and tone.`
    case 'rewrite':
      return `${base}\nTask: Rewrite this selection for clarity, flow, and stronger phrasing while keeping the meaning.`
    case 'shorten':
      return `${base}\nTask: Make this selection shorter and cleaner while keeping the important information.`
    case 'expand':
      return `${base}\nTask: Expand this selection with more useful detail while keeping the same intent and style.`
    case 'fix':
      return `${base}\nTask: Fix grammar, spelling, and awkward phrasing while preserving the meaning.`
    default:
      return base
  }
}

function choosePreferredModel(
  models: Array<{ falId: string }>,
  preferredIds: Array<string>,
  fallbackId?: string,
): string {
  for (const preferredId of preferredIds) {
    if (models.some((model) => model.falId === preferredId)) {
      return preferredId
    }
  }

  if (fallbackId && models.some((model) => model.falId === fallbackId)) {
    return fallbackId
  }

  return models[0]?.falId ?? ''
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatVersionTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

function getVersionSource(name: string): 'auto' | 'manual' {
  return /^auto\b/i.test(name) ? 'auto' : 'manual'
}

function getEditorDocumentText(editor: RichTextEditor): string {
  return editor.getText({ blockSeparator: '\n\n' })
}

function getCurrentTextBlockRange(editor: RichTextEditor) {
  const { $from } = editor.state.selection
  if (!$from.parent.isTextblock) return null
  return {
    from: $from.start(),
    to: $from.end(),
  }
}

function getActiveEditorState(
  editor: RichTextEditor,
  node: Node<BlockNodeData>,
): ActiveTextEditorState {
  const { state } = editor
  const { from, to } = state.selection
  return {
    nodeId: node.id,
    label: node.data.label,
    document: editor.getHTML(),
    documentText: getEditorDocumentText(editor),
    selection: {
      from,
      to,
      text: from === to ? '' : state.doc.textBetween(from, to, '\n\n'),
      textFrom: state.doc.textBetween(0, from, '\n\n').length,
      textTo: state.doc.textBetween(0, to, '\n\n').length,
      currentBlockText: state.selection.$from.parent.textContent,
    },
  }
}

function getAgentInsertContent(value: string): string {
  if (isHtmlDocument(value)) return value

  const trimmed = value.trim()
  if (!trimmed) return ''

  const looksStructured =
    /\n/.test(value) ||
    /^(#{1,3}\s|[-*]\s|\d+\.\s|>\s|```)/m.test(trimmed)

  return looksStructured ? markdownToRichTextHtml(value) || value : value
}

export default function TextEditorWorkspace({
  agentPanelProps,
  node,
  onClose,
  projectId,
  onEditorContextChange,
  onRegisterAgentBridge,
  onUpdateDocument,
  saveStatus,
}: TextEditorWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorScrollRef = useRef<HTMLDivElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const textVersionsMenuRef = useRef<HTMLDivElement>(null)
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const selectionMenuRef = useRef<HTMLDivElement>(null)
  const mediaComposerRef = useRef<HTMLDivElement>(null)
  const mediaComposerOpenedAtRef = useRef(0)
  const autoTextVersionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const lastAutoTextVersionAtRef = useRef(0)
  const lastAutoVersionDocumentRef = useRef('')
  const selectionMenuTimerRef = useRef<number | null>(null)
  const selectionMenuStateRef = useRef<SelectionMenuState | null>(null)
  const activeNodeIdRef = useRef<string | null>(null)
  const lastPublishedHtmlRef = useRef<string | null>(null)
  const onUpdateDocumentRef = useRef(onUpdateDocument)
  onUpdateDocumentRef.current = onUpdateDocument
  const { uploadFile, uploadState } = useFileUpload()
  const createGeneration = useMutation(api.generations.create)
  const setFalRequestId = useMutation(api.generations.setFalRequestId)
  const submitTextGeneration = useAction(api.textGeneration.submit)
  const createTextNodeVersion = useMutation(api.versions.createTextNodeVersion)
  const restoreTextNodeVersion = useMutation(api.versions.restoreTextNodeVersion)
  const imageModels = useQuery(api.models.listByContentType, {
    contentType: 'image',
  })
  const textModels = useQuery(api.models.listByContentType, {
    contentType: 'text',
  })
  const textVersionsResult = useQuery(
    api.versions.listTextNodeVersions,
    node ? { projectId, nodeId: node.id } : 'skip',
  ) as Array<TextDocumentVersion> | undefined
  const textVersions = textVersionsResult ?? []
  const isLoadingTextVersions = Boolean(node) && textVersionsResult === undefined
  const orderedTextVersions = useMemo(
    () => [...textVersions].reverse(),
    [textVersions],
  )
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [slashMenuHeight, setSlashMenuHeight] = useState(0)
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(
    null,
  )
  const [selectionMenuHeight, setSelectionMenuHeight] = useState(0)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showTextVersionsMenu, setShowTextVersionsMenu] = useState(false)
  const [textVersionName, setTextVersionName] = useState('')
  const [isSavingTextVersion, setIsSavingTextVersion] = useState(false)
  const [restoringTextVersionId, setRestoringTextVersionId] = useState<
    Id<'versions'> | null
  >(null)
  const [selectedTextVersionIndex, setSelectedTextVersionIndex] = useState(0)
  const [confirmRestoreVersionId, setConfirmRestoreVersionId] = useState<
    Id<'versions'> | null
  >(null)
  const [exportingFormat, setExportingFormat] = useState<TextExportFormat | null>(
    null,
  )
  const [exportError, setExportError] = useState<string | null>(null)
  const [textVersionError, setTextVersionError] = useState<string | null>(null)
  const [showMediaComposer, setShowMediaComposer] = useState(false)
  const [mediaComposerAnchor, setMediaComposerAnchor] =
    useState<MediaComposerAnchor | null>(null)
  const [mediaComposerHeight, setMediaComposerHeight] = useState(0)
  const [mediaPrompt, setMediaPrompt] = useState('')
  const [selectedImageModelId, setSelectedImageModelId] = useState('')
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [helperError, setHelperError] = useState<string | null>(null)
  const [pendingTextHelper, setPendingTextHelper] =
    useState<PendingTextHelper | null>(null)
  const [pendingMediaGeneration, setPendingMediaGeneration] =
    useState<PendingMediaGeneration | null>(null)

  const clearPendingSelectionMenu = useCallback(() => {
    if (
      selectionMenuTimerRef.current !== null &&
      typeof window !== 'undefined'
    ) {
      window.clearTimeout(selectionMenuTimerRef.current)
      selectionMenuTimerRef.current = null
    }
  }, [])

  const clearAutoTextVersionTimer = useCallback(() => {
    if (autoTextVersionTimerRef.current) {
      clearTimeout(autoTextVersionTimerRef.current)
      autoTextVersionTimerRef.current = null
    }
  }, [])

  const mediaGeneration = useQuery(
    api.generations.get,
    pendingMediaGeneration
      ? { id: pendingMediaGeneration.generationId }
      : 'skip',
  )
  const textHelperGeneration = useQuery(
    api.generations.get,
    pendingTextHelper ? { id: pendingTextHelper.generationId } : 'skip',
  )

  const value =
    node?.data.contentType === 'text'
      ? (node.data.resultText ?? node.data.prompt)
      : ''
  const label =
    node?.data.contentType === 'text' ? node.data.label : 'Document editor'

  const initialContent = useMemo(
    () => (isHtmlDocument(value) ? value : markdownToRichTextHtml(value)),
    [value],
  )

  const preferredImageModelId = useMemo(
    () =>
      choosePreferredModel(imageModels ?? [], [
        'fal-ai/flux-1/schnell',
        'fal-ai/nano-banana-2',
        'fal-ai/flux-pro/v1.1-ultra',
      ]),
    [imageModels],
  )

  const textHelperModelId = useMemo(
    () =>
      choosePreferredModel(
        textModels ?? [],
        ['anthropic/claude-sonnet-4.6', 'minimax/minimax-m2.1'],
        agentPanelProps.agentModel,
      ),
    [agentPanelProps.agentModel, textModels],
  )

  const updateSlashMenu = useCallback(
    (nextEditor: RichTextEditor) => {
      const { state, view } = nextEditor
      const { from, empty } = state.selection

      if (!empty) {
        setSlashMenu(null)
        return
      }

      const { $from } = state.selection
      if (!$from.parent.isTextblock) {
        setSlashMenu(null)
        return
      }

      const beforeCursor = $from.parent.textContent.slice(0, $from.parentOffset)
      const match = beforeCursor.match(/\/([a-z0-9 -]*)$/i)
      if (!match) {
        setSlashMenu(null)
        return
      }

      const coords = view.coordsAtPos(from)
      setSlashMenu({
        query: (match[1] || '').toLowerCase(),
        range: { from: from - match[0].length, to: from },
        x: coords.left,
        caretTop: coords.top,
        caretBottom: coords.bottom,
      })
    },
    [],
  )

  const updateSelectionMenu = useCallback(
    (nextEditor: RichTextEditor) => {
      if (pendingTextHelper) {
        clearPendingSelectionMenu()
        setSelectionMenu(null)
        return
      }

      const { state, view } = nextEditor
      const { from, to, empty } = state.selection

      if (empty || from === to) {
        clearPendingSelectionMenu()
        setSelectionMenu(null)
        return
      }

      const selectedText = state.doc.textBetween(from, to, '\n\n').trim()
      if (!selectedText) {
        clearPendingSelectionMenu()
        setSelectionMenu(null)
        return
      }

      let left = (view.coordsAtPos(from).left + view.coordsAtPos(to).left) / 2
      let selectionTop = view.coordsAtPos(from).top
      let selectionBottom = view.coordsAtPos(to).bottom

      const domSelection = window.getSelection()
      if (
        domSelection &&
        domSelection.rangeCount > 0 &&
        view.dom.contains(domSelection.anchorNode)
      ) {
        const rect = domSelection.getRangeAt(0).getBoundingClientRect()
        if (rect.width > 0 || rect.height > 0) {
          left = rect.left + rect.width / 2
          selectionTop = rect.top
          selectionBottom = rect.bottom
        }
      }

      const nextMenu = {
        text: selectedText,
        range: { from, to },
        x: left,
        selectionTop,
        selectionBottom,
      }

      const currentMenu = selectionMenuStateRef.current
      if (
        currentMenu &&
        currentMenu.text === nextMenu.text &&
        currentMenu.range.from === nextMenu.range.from &&
        currentMenu.range.to === nextMenu.range.to
      ) {
        clearPendingSelectionMenu()
        setSelectionMenu(nextMenu)
        return
      }

      clearPendingSelectionMenu()
      setSelectionMenu(null)

      if (typeof window === 'undefined') {
        setSelectionMenu(nextMenu)
        return
      }

      selectionMenuTimerRef.current = window.setTimeout(() => {
        setSelectionMenu(nextMenu)
        selectionMenuTimerRef.current = null
      }, SELECTION_MENU_DELAY_MS)
    },
    [clearPendingSelectionMenu, pendingTextHelper],
  )

  const publishEditorContext = useCallback(
    (nextEditor: RichTextEditor | null) => {
      if (!onEditorContextChange) return
      if (!nextEditor || !node) {
        onEditorContextChange(null)
        return
      }
      onEditorContextChange(getActiveEditorState(nextEditor, node))
    },
    [node, onEditorContextChange],
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        undoRedo: {
          depth: 150,
          newGroupDelay: 300,
        },
      }),
      TableKit.configure({
        table: {
          resizable: true,
        },
      }),
      RichImage,
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor: nextEditor }) => {
      const html = nextEditor.getHTML()
      lastPublishedHtmlRef.current = html
      onUpdateDocumentRef.current(html)
      updateSlashMenu(nextEditor)
      updateSelectionMenu(nextEditor)
      publishEditorContext(nextEditor)
    },
    onSelectionUpdate: ({ editor: nextEditor }) => {
      updateSlashMenu(nextEditor)
      updateSelectionMenu(nextEditor)
      publishEditorContext(nextEditor)
    },
    editorProps: {
      attributes: {
        class:
          'nodrag nowheel dark-scrollbar min-h-[calc(100vh-15rem)] w-full outline-none px-8 py-10 text-[16px] leading-8 text-zinc-300 caret-zinc-100 selection:bg-zinc-700 selection:text-zinc-50 sm:px-12 sm:py-12 [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-zinc-500 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.selectedCell]:bg-zinc-700/35 [&_a]:text-blue-400 [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-700 [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-[1.9rem] [&_h1]:leading-tight [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-[1.45rem] [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-[1.1rem] [&_h3]:font-semibold [&_hr]:my-5 [&_hr]:border-zinc-800 [&_li]:my-1 [&_ol]:my-3 [&_ol]:pl-6 [&_p]:my-2.5 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950 [&_pre]:p-3 [&_strong]:font-semibold [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-zinc-800 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-zinc-700 [&_th]:bg-zinc-900 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6',
      },
    },
  })

  const applyTextEditAction = useCallback(
    (action: EditTextNodeAction) => {
      if (!editor || !node || action.nodeId !== node.id) return false

      const content = action.text ? getAgentInsertContent(action.text) : ''
      const { from, to, empty } = editor.state.selection

      switch (action.mode) {
        case 'replace_selection':
          if (!content || empty) return false
          return editor.chain().focus().insertContent(content).run()
        case 'insert_before_selection':
          if (!content || empty) return false
          return editor.chain().focus().insertContentAt(from, content).run()
        case 'insert_after_selection':
          if (!content || empty) return false
          return editor.chain().focus().insertContentAt(to, content).run()
        case 'insert_at_cursor':
          if (!content) return false
          return editor.chain().focus().insertContent(content).run()
        case 'delete_selection':
          if (empty) return false
          return editor.chain().focus().deleteSelection().run()
        default:
          return false
      }
    },
    [editor, node],
  )

  const applyTextFormatAction = useCallback(
    (action: FormatTextNodeAction) => {
      if (!editor || !node || action.nodeId !== node.id) return false
      if (action.target === 'text') return false

      const hasSelection = !editor.state.selection.empty
      if (action.target === 'selection' && !hasSelection) {
        return false
      }

      const chain = editor.chain().focus()
      if (action.target === 'current_block') {
        const range = getCurrentTextBlockRange(editor)
        if (!range) return false
        chain.setTextSelection(range)
      }

      switch (action.format) {
        case 'bold':
          return chain.setBold().run()
        case 'italic':
          return chain.setItalic().run()
        case 'heading':
          if (!action.level) return false
          return chain.setHeading({ level: action.level }).run()
        case 'paragraph':
          return chain.setParagraph().run()
        case 'bullet_list':
          if (editor.isActive('bulletList')) return true
          return chain.toggleBulletList().run()
        case 'ordered_list':
          if (editor.isActive('orderedList')) return true
          return chain.toggleOrderedList().run()
        case 'blockquote':
          if (editor.isActive('blockquote')) return true
          return chain.toggleBlockquote().run()
        case 'code_block':
          if (editor.isActive('codeBlock')) return true
          return chain.toggleCodeBlock().run()
        default:
          return false
      }
    },
    [editor, node],
  )

  const closeMediaComposer = useCallback(() => {
    setShowMediaComposer(false)
    setMediaComposerAnchor(null)
  }, [])

  const openMediaComposer = useCallback(
    ({
      prompt,
      anchor,
    }: {
      prompt?: string
      anchor?: MediaComposerAnchor | null
    } = {}) => {
      setMediaError(null)
      mediaComposerOpenedAtRef.current =
        typeof performance !== 'undefined' ? performance.now() : 0
      setShowMediaComposer(true)
      setMediaComposerAnchor(anchor ?? null)
      if (prompt !== undefined) {
        setMediaPrompt(prompt.trim())
      }
    },
    [],
  )

  const runSlashCommand = useCallback(
    (commandId: string) => {
      if (!editor || !slashMenu) return

      switch (commandId) {
        case 'heading-1':
          editor
            .chain()
            .focus()
            .deleteRange(slashMenu.range)
            .setHeading({ level: 1 })
            .run()
          break
        case 'heading-2':
          editor
            .chain()
            .focus()
            .deleteRange(slashMenu.range)
            .setHeading({ level: 2 })
            .run()
          break
        case 'bold':
          editor
            .chain()
            .focus()
            .deleteRange(slashMenu.range)
            .toggleBold()
            .run()
          break
        case 'italic':
          editor
            .chain()
            .focus()
            .deleteRange(slashMenu.range)
            .toggleItalic()
            .run()
          break
        case 'bullet-list':
          editor
            .chain()
            .focus()
            .deleteRange(slashMenu.range)
            .toggleBulletList()
            .run()
          break
        case 'ordered-list':
          editor
            .chain()
            .focus()
            .deleteRange(slashMenu.range)
            .toggleOrderedList()
            .run()
          break
        case 'quote':
          editor
            .chain()
            .focus()
            .deleteRange(slashMenu.range)
            .toggleBlockquote()
            .run()
          break
        case 'code-block':
          editor
            .chain()
            .focus()
            .deleteRange(slashMenu.range)
            .toggleCodeBlock()
            .run()
          break
        case 'divider':
          editor
            .chain()
            .focus()
            .deleteRange(slashMenu.range)
            .setHorizontalRule()
            .run()
          break
        case 'image-generate':
          editor.chain().focus().deleteRange(slashMenu.range).run()
          openMediaComposer({
            anchor: {
              source: 'slash-menu',
              x: slashMenu.x,
              y: slashMenu.caretBottom,
              align: 'center',
            },
          })
          break
        case 'image-upload':
          editor.chain().focus().deleteRange(slashMenu.range).run()
          fileInputRef.current?.click()
          break
        default:
          break
      }

      setSlashMenu(null)
    },
    [editor, openMediaComposer, slashMenu],
  )

  const runTextHelper = useCallback(
    async (actionId: SelectionHelperAction['id']) => {
      if (!editor || !selectionMenu || !textHelperModelId) return

      setHelperError(null)
      setSelectionMenu(null)

      try {
        editor.chain().focus().setTextSelection(selectionMenu.range).run()

        const generationId = await createGeneration({
          contentType: 'text',
          modelId: textHelperModelId,
          prompt: buildSelectionHelperPrompt(actionId, selectionMenu.text),
        })

        const actionLabel =
          SELECTION_HELPER_ACTIONS.find((action) => action.id === actionId)
            ?.label ?? 'AI helper'

        setPendingTextHelper({
          actionLabel,
          generationId,
          range: selectionMenu.range,
          anchorX: selectionMenu.x,
          anchorTop: selectionMenu.selectionTop,
          anchorBottom: selectionMenu.selectionBottom,
        })

        await submitTextGeneration({ generationId })
      } catch (error) {
        setPendingTextHelper(null)
        setHelperError(
          error instanceof Error ? error.message : 'AI helper failed',
        )
      }
    },
    [
      createGeneration,
      editor,
      selectionMenu,
      submitTextGeneration,
      textHelperModelId,
    ],
  )

  const handleGenerateImage = useCallback(async () => {
    if (!editor || !selectedImageModelId) return

    const prompt = mediaPrompt.trim()
    if (!prompt) {
      setMediaError('Write an image prompt first.')
      return
    }

    setMediaError(null)

    try {
      const generationId = await createGeneration({
        contentType: 'image',
        modelId: selectedImageModelId,
        prompt,
      })

      setPendingMediaGeneration({
        generationId,
        insertPos: editor.state.selection.to,
        prompt,
      })

      const { requestId } = await submitToFal({
        data: {
          model: selectedImageModelId,
          prompt,
          contentType: 'image',
        },
      })

      await setFalRequestId({
        id: generationId,
        falRequestId: requestId,
      })
    } catch (error) {
      setPendingMediaGeneration(null)
      setMediaError(
        error instanceof Error ? error.message : 'Image generation failed',
      )
    }
  }, [
    createGeneration,
    editor,
    mediaPrompt,
    selectedImageModelId,
    setFalRequestId,
  ])

  const handleExport = useCallback(
    async (format: TextExportFormat) => {
      if (!editor || !node) return

      setExportError(null)
      setExportingFormat(format)

      try {
        await exportTextDocument({
          document: editor.getHTML(),
          fallbackLabel: node.data.label,
          format,
        })
        setShowExportMenu(false)
      } catch (error) {
        setExportError(error instanceof Error ? error.message : 'Export failed')
      } finally {
        setExportingFormat(null)
      }
    },
    [editor, node],
  )

  const handleSaveTextVersion = useCallback(
    async (mode: 'manual' | 'auto' = 'manual') => {
      if (!editor || !node || (mode === 'manual' && isSavingTextVersion)) return

      clearAutoTextVersionTimer()
      const document = editor.getHTML()
      const hasContent = Boolean(editor.getText({ blockSeparator: '\n\n' }).trim())
      if (!hasContent) return

      const now = Date.now()
      const name =
        mode === 'manual'
          ? textVersionName.trim() || `Snapshot ${new Date(now).toLocaleString()}`
          : `Auto ${new Date(now).toLocaleString()}`

      if (mode === 'manual') {
        setTextVersionError(null)
        setIsSavingTextVersion(true)
      }

      try {
        await createTextNodeVersion({
          projectId,
          nodeId: node.id,
          name,
          document,
        })
        onUpdateDocumentRef.current(document)
        lastAutoTextVersionAtRef.current = now
        lastAutoVersionDocumentRef.current = document

        if (mode === 'manual') {
          setTextVersionName('')
          setShowTextVersionsMenu(true)
        }
      } catch (error) {
        if (mode === 'manual') {
          setTextVersionError(
            error instanceof Error ? error.message : 'Failed to save text version',
          )
        } else {
          console.error('Auto text version save failed', error)
        }
      } finally {
        if (mode === 'manual') {
          setIsSavingTextVersion(false)
        }
      }
    },
    [
      createTextNodeVersion,
      clearAutoTextVersionTimer,
      editor,
      isSavingTextVersion,
      node,
      projectId,
      textVersionName,
    ],
  )

  const handleRestoreTextVersion = useCallback(
    async (version: TextDocumentVersion) => {
      if (!editor || !node || restoringTextVersionId) return

      setTextVersionError(null)
      setRestoringTextVersionId(version._id)
      try {
        const result = await restoreTextNodeVersion({
          projectId,
          versionId: version._id,
          nodeId: node.id,
        })

        const restoredDocument =
          typeof result.document === 'string' ? result.document : version.document
        lastPublishedHtmlRef.current = restoredDocument
        editor.commands.setContent(restoredDocument || '<p></p>', {
          emitUpdate: false,
        })
        onUpdateDocumentRef.current(restoredDocument)
        lastAutoTextVersionAtRef.current = Date.now()
        lastAutoVersionDocumentRef.current = restoredDocument
        setConfirmRestoreVersionId(null)
        publishEditorContext(editor)
      } catch (error) {
        setTextVersionError(
          error instanceof Error
            ? error.message
            : 'Failed to restore text version',
        )
      } finally {
        setRestoringTextVersionId(null)
      }
    },
    [
      editor,
      node,
      projectId,
      publishEditorContext,
      restoreTextNodeVersion,
      restoringTextVersionId,
    ],
  )

  const handleRestoreSelectedTextVersion = useCallback(() => {
    const selectedVersion = orderedTextVersions[selectedTextVersionIndex]

    if (confirmRestoreVersionId !== selectedVersion._id) {
      setConfirmRestoreVersionId(selectedVersion._id)
      return
    }

    void handleRestoreTextVersion(selectedVersion)
  }, [
    confirmRestoreVersionId,
    handleRestoreTextVersion,
    orderedTextVersions,
    selectedTextVersionIndex,
  ])

  const selectPreviousTextVersion = useCallback(() => {
    setSelectedTextVersionIndex((current) => Math.max(current - 1, 0))
  }, [])

  const selectNextTextVersion = useCallback(() => {
    setSelectedTextVersionIndex((current) =>
      Math.min(current + 1, Math.max(orderedTextVersions.length - 1, 0)),
    )
  }, [orderedTextVersions.length])

  const filteredSlashCommands = useMemo(() => {
    const query = (slashMenu ? slashMenu.query : '').trim()
    if (!query) return SLASH_COMMANDS

    return SLASH_COMMANDS.filter((command) => {
      const haystack = `${command.label} ${command.keywords}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [slashMenu?.query])

  useEffect(() => {
    if (orderedTextVersions.length === 0) {
      setSelectedTextVersionIndex(0)
      setConfirmRestoreVersionId(null)
      return
    }

    setSelectedTextVersionIndex((current) =>
      Math.min(current, orderedTextVersions.length - 1),
    )
  }, [orderedTextVersions.length])

  useEffect(() => {
    setConfirmRestoreVersionId(null)
  }, [selectedTextVersionIndex])

  useEffect(() => {
    clearAutoTextVersionTimer()
    if (!node || node.data.contentType !== 'text') return

    const currentDocument = node.data.resultText ?? node.data.prompt
    lastAutoVersionDocumentRef.current = currentDocument
    lastAutoTextVersionAtRef.current = Date.now()
  }, [clearAutoTextVersionTimer, node?.id])

  useEffect(() => {
    if (!editor || !node) return
    if (restoringTextVersionId || pendingTextHelper) return

    const currentDocument = editor.getHTML()
    if (currentDocument === lastAutoVersionDocumentRef.current) return

    clearAutoTextVersionTimer()

    const elapsedSinceLastAuto = Date.now() - lastAutoTextVersionAtRef.current
    const delay = Math.max(
      AUTO_TEXT_VERSION_IDLE_MS,
      AUTO_TEXT_VERSION_MIN_GAP_MS - elapsedSinceLastAuto,
    )

    autoTextVersionTimerRef.current = setTimeout(() => {
      void handleSaveTextVersion('auto')
    }, delay)

    return clearAutoTextVersionTimer
  }, [
    clearAutoTextVersionTimer,
    editor,
    handleSaveTextVersion,
    node,
    pendingTextHelper,
    restoringTextVersionId,
    value,
  ])

  useEffect(() => {
    if (!node) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (showExportMenu) {
          setShowExportMenu(false)
          return
        }
        if (showTextVersionsMenu) {
          setShowTextVersionsMenu(false)
          return
        }
        if (showMediaComposer) {
          closeMediaComposer()
          return
        }
        onClose()
      }

      if (
        slashMenu &&
        event.key === 'Enter' &&
        filteredSlashCommands.length > 0
      ) {
        event.preventDefault()
        runSlashCommand(filteredSlashCommands[0].id)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [
    closeMediaComposer,
    node,
    onClose,
    filteredSlashCommands,
    runSlashCommand,
    showExportMenu,
    showTextVersionsMenu,
    showMediaComposer,
    slashMenu,
  ])

  useEffect(() => {
    if (!showExportMenu) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        setShowExportMenu(false)
        return
      }

      if (!exportMenuRef.current?.contains(target)) {
        setShowExportMenu(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [showExportMenu])

  useEffect(() => {
    if (!showTextVersionsMenu) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        setShowTextVersionsMenu(false)
        return
      }

      if (!textVersionsMenuRef.current?.contains(target)) {
        setShowTextVersionsMenu(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [showTextVersionsMenu])

  useEffect(() => {
    if (!showMediaComposer) return

    const handlePointerDown = (event: PointerEvent) => {
      if (event.timeStamp - mediaComposerOpenedAtRef.current < 140) {
        return
      }

      const target = event.target
      if (!(target instanceof Element)) {
        closeMediaComposer()
        return
      }

      if (!mediaComposerRef.current?.contains(target)) {
        closeMediaComposer()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [closeMediaComposer, showMediaComposer])

  useEffect(() => {
    if (!slashMenu) {
      setSlashMenuHeight(0)
      return
    }

    const menuElement = slashMenuRef.current
    if (!menuElement) return

    const updateHeight = () => {
      setSlashMenuHeight(menuElement.getBoundingClientRect().height)
    }

    updateHeight()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(updateHeight)
    observer.observe(menuElement)

    return () => observer.disconnect()
  }, [filteredSlashCommands.length, slashMenu])

  useEffect(() => {
    if (!selectionMenu) {
      setSelectionMenuHeight(0)
      return
    }

    const menuElement = selectionMenuRef.current
    if (!menuElement) return

    const updateHeight = () => {
      setSelectionMenuHeight(menuElement.getBoundingClientRect().height)
    }

    updateHeight()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(updateHeight)
    observer.observe(menuElement)

    return () => observer.disconnect()
  }, [selectionMenu])

  useEffect(() => {
    if (!showMediaComposer) {
      setMediaComposerHeight(0)
      return
    }

    const composerElement = mediaComposerRef.current
    if (!composerElement) return

    const updateHeight = () => {
      setMediaComposerHeight(composerElement.getBoundingClientRect().height)
    }

    updateHeight()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(updateHeight)
    observer.observe(composerElement)

    return () => observer.disconnect()
  }, [showMediaComposer])

  useEffect(() => {
    selectionMenuStateRef.current = selectionMenu
  }, [selectionMenu])

  useEffect(() => {
    if (!imageModels || imageModels.length === 0) return

    if (
      !selectedImageModelId ||
      !imageModels.some((model) => model.falId === selectedImageModelId)
    ) {
      setSelectedImageModelId(preferredImageModelId)
    }
  }, [imageModels, preferredImageModelId, selectedImageModelId])

  useEffect(() => {
    publishEditorContext(editor)
  }, [editor, publishEditorContext])

  useEffect(() => {
    if (!onRegisterAgentBridge || !editor || !node) {
      onRegisterAgentBridge?.(null)
      return
    }

    onRegisterAgentBridge({
      nodeId: node.id,
      applyTextEditAction,
      applyTextFormatAction,
    })

    return () => onRegisterAgentBridge(null)
  }, [
    applyTextEditAction,
    applyTextFormatAction,
    editor,
    node,
    onRegisterAgentBridge,
  ])

  useEffect(() => {
    if (!editor) return

    const syncMenus = () => {
      updateSlashMenu(editor)
      updateSelectionMenu(editor)
    }

    syncMenus()

    const scrollElement = editorScrollRef.current
    window.addEventListener('resize', syncMenus)
    scrollElement?.addEventListener('scroll', syncMenus, { passive: true })

    return () => {
      window.removeEventListener('resize', syncMenus)
      scrollElement?.removeEventListener('scroll', syncMenus)
    }
  }, [editor, updateSelectionMenu, updateSlashMenu])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!pendingTextHelper)
  }, [editor, pendingTextHelper])

  useEffect(() => {
    if (!editor || !pendingTextHelper || !textHelperGeneration) return

    if (
      textHelperGeneration.status === 'completed' &&
      textHelperGeneration.resultText
    ) {
      const replacement = isHtmlDocument(textHelperGeneration.resultText)
        ? textHelperGeneration.resultText
        : markdownToRichTextHtml(textHelperGeneration.resultText)

      editor
        .chain()
        .focus()
        .insertContentAt(
          pendingTextHelper.range,
          replacement || textHelperGeneration.resultText,
        )
        .run()

      setPendingTextHelper(null)
      setHelperError(null)
      return
    }

    if (textHelperGeneration.status === 'error') {
      setPendingTextHelper(null)
      setHelperError(
        textHelperGeneration.errorMessage || 'AI helper generation failed',
      )
    }
  }, [editor, pendingTextHelper, textHelperGeneration])

  useEffect(() => {
    if (!editor || !pendingMediaGeneration || !mediaGeneration) return

    if (mediaGeneration.status === 'completed' && mediaGeneration.resultUrl) {
      const insertPos = Math.max(
        0,
        Math.min(pendingMediaGeneration.insertPos, editor.state.doc.content.size),
      )

      editor
        .chain()
        .focus()
        .insertContentAt(insertPos, {
          type: 'image',
          attrs: {
            src: mediaGeneration.resultUrl,
            alt: pendingMediaGeneration.prompt.slice(0, 120),
            title: pendingMediaGeneration.prompt.slice(0, 120),
          },
        })
        .run()

      setPendingMediaGeneration(null)
      setMediaError(null)
      closeMediaComposer()
      return
    }

    if (mediaGeneration.status === 'error') {
      setPendingMediaGeneration(null)
      setMediaError(mediaGeneration.errorMessage || 'Image generation failed')
    }
  }, [closeMediaComposer, editor, mediaGeneration, pendingMediaGeneration])

  useEffect(() => {
    if (!editor || !node) return

    const nextContent = isHtmlDocument(value)
      ? value
      : markdownToRichTextHtml(value)

    if (activeNodeIdRef.current !== node.id) {
      activeNodeIdRef.current = node.id
      lastPublishedHtmlRef.current = nextContent
      editor.commands.setContent(nextContent || '<p></p>', {
        emitUpdate: false,
      })
      setShowExportMenu(false)
      setShowTextVersionsMenu(false)
      setTextVersionName('')
      setSelectedTextVersionIndex(0)
      setConfirmRestoreVersionId(null)
      setSlashMenu(null)
      setSelectionMenu(null)
      setExportError(null)
      setTextVersionError(null)
      setRestoringTextVersionId(null)
      closeMediaComposer()
      setMediaError(null)
      setHelperError(null)
      setPendingMediaGeneration(null)
      setPendingTextHelper(null)
      publishEditorContext(editor)
      return
    }

    // Keep history intact: skip setContent when this update came from local typing.
    if (lastPublishedHtmlRef.current === nextContent) {
      return
    }

    if (editor.getHTML() !== nextContent) {
      lastPublishedHtmlRef.current = nextContent
      editor.commands.setContent(nextContent || '<p></p>', {
        emitUpdate: false,
      })
      publishEditorContext(editor)
    }
  }, [closeMediaComposer, editor, node, publishEditorContext, value])

  useEffect(() => {
    if (!editor || !node) return
    requestAnimationFrame(() => editor.commands.focus('end'))
  }, [editor, node?.id])

  useEffect(() => {
    return () => {
      clearAutoTextVersionTimer()
      clearPendingSelectionMenu()
      onEditorContextChange?.(null)
      onRegisterAgentBridge?.(null)
    }
  }, [
    clearAutoTextVersionTimer,
    clearPendingSelectionMenu,
    onEditorContextChange,
    onRegisterAgentBridge,
  ])

  const handleImageUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file || !editor) return

      try {
        const result = await uploadFile(file, 'image')

        editor
          .chain()
          .focus()
          .insertContent({
            type: 'image',
            attrs: {
              src: result.url,
              alt: file.name,
              title: file.name,
            },
          })
          .run()
      } catch (error) {
        console.error('Editor image upload failed', error)
      } finally {
        event.target.value = ''
      }
    },
    [editor, uploadFile],
  )

  if (!node) {
    return null
  }

  const selectedTextVersion =
    orderedTextVersions[selectedTextVersionIndex] ?? null
  const totalTextVersions = orderedTextVersions.length
  const canMoveToOlderVersion = selectedTextVersionIndex > 0
  const canMoveToNewerVersion =
    selectedTextVersionIndex < Math.max(totalTextVersions - 1, 0)
  const plainText = editor?.getText({ blockSeparator: '\n\n' }).trim() || ''
  const wordCount = plainText
    ? plainText.split(/\s+/).filter(Boolean).length
    : 0
  const exportStatusLabel =
    exportingFormat === 'pdf'
      ? 'Exporting PDF...'
      : exportingFormat === 'markdown'
        ? 'Exporting Markdown...'
        : exportingFormat === 'document'
          ? 'Exporting Document...'
          : null
  const isGeneratingImage =
    Boolean(pendingMediaGeneration) &&
    (mediaGeneration?.status === 'submitted' ||
      mediaGeneration?.status === 'processing' ||
      mediaGeneration == null)
  const isRunningTextHelper =
    Boolean(pendingTextHelper) &&
    (textHelperGeneration?.status === 'submitted' ||
      textHelperGeneration?.status === 'processing' ||
      textHelperGeneration == null)
  const slashMenuWidth = 288
  const slashLeft = slashMenu
    ? Math.max(
        12,
        Math.min(slashMenu.x, window.innerWidth - slashMenuWidth - 12),
      )
    : 0
  const estimatedSlashMenuHeight =
    slashMenuHeight ||
    Math.min(56 + filteredSlashCommands.length * 40, 56 + 288)
  const slashMenuSpaceAbove = slashMenu ? slashMenu.caretTop - 12 : 0
  const slashMenuSpaceBelow = slashMenu
    ? window.innerHeight - slashMenu.caretBottom - 12
    : 0
  const shouldPlaceSlashMenuAbove = slashMenu
    ? slashMenuSpaceBelow < estimatedSlashMenuHeight + 8 &&
      slashMenuSpaceAbove > slashMenuSpaceBelow
    : false
  const slashTop = slashMenu
    ? shouldPlaceSlashMenuAbove
      ? Math.max(12, slashMenu.caretTop - estimatedSlashMenuHeight - 8)
      : Math.min(
          window.innerHeight - estimatedSlashMenuHeight - 12,
          slashMenu.caretBottom + 8,
        )
    : 0
  const selectionMenuWidth = 428
  const selectionLeft = selectionMenu
    ? Math.max(
        12,
        Math.min(
          selectionMenu.x - selectionMenuWidth / 2,
          window.innerWidth - selectionMenuWidth - 12,
        ),
      )
    : 0
  const estimatedSelectionMenuHeight = selectionMenuHeight || 52
  const selectionMenuSpaceAbove = selectionMenu
    ? selectionMenu.selectionTop - 12
    : 0
  const selectionMenuSpaceBelow = selectionMenu
    ? window.innerHeight - selectionMenu.selectionBottom - 12
    : 0
  const shouldPlaceSelectionMenuBelow = selectionMenu
    ? selectionMenuSpaceAbove < estimatedSelectionMenuHeight + 8 &&
      selectionMenuSpaceBelow > selectionMenuSpaceAbove
    : false
  const selectionTop = selectionMenu
    ? shouldPlaceSelectionMenuBelow
      ? Math.min(
          window.innerHeight - estimatedSelectionMenuHeight - 12,
          selectionMenu.selectionBottom + 10,
        )
      : Math.max(
          12,
          selectionMenu.selectionTop - estimatedSelectionMenuHeight - 10,
        )
    : 0
  const helperStatusWidth = 248
  const helperStatusLeft = pendingTextHelper
    ? Math.max(
        12,
        Math.min(
          pendingTextHelper.anchorX - helperStatusWidth / 2,
          window.innerWidth - helperStatusWidth - 12,
        ),
      )
    : 0
  const helperStatusHeight = 44
  const helperStatusSpaceAbove = pendingTextHelper
    ? pendingTextHelper.anchorTop - 12
    : 0
  const helperStatusSpaceBelow = pendingTextHelper
    ? window.innerHeight - pendingTextHelper.anchorBottom - 12
    : 0
  const shouldPlaceHelperStatusBelow = pendingTextHelper
    ? helperStatusSpaceAbove < helperStatusHeight + 8 &&
      helperStatusSpaceBelow > helperStatusSpaceAbove
    : false
  const helperStatusTop = pendingTextHelper
    ? shouldPlaceHelperStatusBelow
      ? Math.min(
          window.innerHeight - helperStatusHeight - 12,
          pendingTextHelper.anchorBottom + 10,
        )
      : Math.max(12, pendingTextHelper.anchorTop - helperStatusHeight - 10)
    : 0
  const mediaComposerWidth = Math.min(448, window.innerWidth - 24)
  const mediaComposerAnchorX = mediaComposerAnchor?.x ?? window.innerWidth - 24
  const mediaComposerAnchorY = mediaComposerAnchor?.y ?? 128
  const mediaComposerAnchorAlign = mediaComposerAnchor?.align ?? 'end'
  const mediaComposerRawLeft =
    mediaComposerAnchorAlign === 'center'
      ? mediaComposerAnchorX - mediaComposerWidth / 2
      : mediaComposerAnchorAlign === 'start'
        ? mediaComposerAnchorX
        : mediaComposerAnchorX - mediaComposerWidth
  const mediaComposerLeft = Math.max(
    12,
    Math.min(mediaComposerRawLeft, window.innerWidth - mediaComposerWidth - 12),
  )
  const estimatedMediaComposerHeight = mediaComposerHeight || 380
  const mediaComposerSpaceAbove = mediaComposerAnchorY - 12
  const mediaComposerSpaceBelow = window.innerHeight - mediaComposerAnchorY - 12
  const shouldPlaceMediaComposerAbove =
    mediaComposerSpaceBelow < estimatedMediaComposerHeight + 8 &&
    mediaComposerSpaceAbove > mediaComposerSpaceBelow
  const mediaComposerTop = shouldPlaceMediaComposerAbove
    ? Math.max(12, mediaComposerAnchorY - estimatedMediaComposerHeight - 8)
    : Math.max(
        12,
        Math.min(
          window.innerHeight - estimatedMediaComposerHeight - 12,
          mediaComposerAnchorY + 8,
        ),
      )

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-zinc-900">
      <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="flex min-h-0 flex-col border-r border-zinc-800/60 bg-zinc-900">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-800/60 bg-zinc-900 px-7 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3 text-zinc-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700/70 bg-zinc-800/40 text-zinc-300">
                  <SquarePen size={17} strokeWidth={1.8} />
                </span>
                <span className="truncate text-base font-semibold tracking-[-0.02em]">
                  {label}
                </span>
              </div>
              <div className="mt-1 pl-[3.25rem] text-xs text-zinc-500">
                Text editor workspace
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isRunningTextHelper && pendingTextHelper && (
                <div className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-300">
                  {pendingTextHelper.actionLabel}...
                </div>
              )}
              {isGeneratingImage && (
                <div className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-300">
                  Generating image...
                </div>
              )}
              {exportStatusLabel && (
                <div className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-300">
                  {exportStatusLabel}
                </div>
              )}
              <div className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-400">
                {wordCount} words
              </div>
              {saveStatus && (
                <div
                  className={`rounded-full border px-3 py-1 text-[11px] ${
                    saveStatus === 'saved'
                      ? 'border-emerald-800 text-emerald-400'
                      : saveStatus === 'saving'
                        ? 'border-zinc-700 text-zinc-400'
                        : 'border-amber-800 text-amber-400'
                  }`}
                >
                  {saveStatus === 'saved'
                    ? 'Saved'
                    : saveStatus === 'saving'
                      ? 'Saving...'
                      : 'Unsaved'}
                </div>
              )}
              <div ref={exportMenuRef} className="relative">
                <button
                  type="button"
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => {
                    if (!editor || exportingFormat) return
                    setExportError(null)
                    setShowExportMenu((current) => !current)
                  }}
                  disabled={!editor || Boolean(exportingFormat)}
                  title="Export document"
                >
                  {exportingFormat ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} strokeWidth={1.8} />
                  )}
                  <span>Export</span>
                  <ChevronDown
                    size={14}
                    strokeWidth={1.8}
                    className={`transition-transform ${
                      showExportMenu ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {showExportMenu && (
                  <div className="absolute top-full right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                    <div className="border-b border-zinc-800/60 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Export as
                    </div>
                    <div className="py-1.5">
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
                        onClick={() => void handleExport('pdf')}
                      >
                        <span>PDF</span>
                        <span className="text-xs text-zinc-500">.pdf</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
                        onClick={() => void handleExport('markdown')}
                      >
                        <span>Markdown</span>
                        <span className="text-xs text-zinc-500">.md</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
                        onClick={() => void handleExport('document')}
                      >
                        <span>Document</span>
                        <span className="text-xs text-zinc-500">.docx</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div ref={textVersionsMenuRef} className="relative">
                <button
                  type="button"
                  className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors ${
                    showTextVersionsMenu
                      ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                  }`}
                  onClick={() => {
                    setTextVersionError(null)
                    setShowTextVersionsMenu((current) => {
                      const next = !current
                      if (next) {
                        const latestIndex = Math.max(
                          orderedTextVersions.length - 1,
                          0,
                        )
                        setSelectedTextVersionIndex(latestIndex)
                        setConfirmRestoreVersionId(null)
                      }
                      return next
                    })
                  }}
                  disabled={!editor}
                  title="Text document versions"
                >
                  <History size={14} strokeWidth={1.8} />
                  <span>Text Versions</span>
                  <span className="rounded-full border border-zinc-700 px-1.5 py-0.5 text-[10px] leading-none text-zinc-400">
                    {totalTextVersions}
                  </span>
                </button>
                {showTextVersionsMenu && (
                  <div className="absolute top-full right-0 z-30 mt-2 w-[26rem] overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                    <div className="flex items-center justify-between border-b border-zinc-800/60 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        Text Versions
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {isLoadingTextVersions
                          ? 'Loading...'
                          : `${totalTextVersions} revision${totalTextVersions === 1 ? '' : 's'}`}
                      </div>
                    </div>
                    <div className="border-b border-zinc-800/60 px-3 py-3">
                      <div className="mb-2 text-[11px] text-zinc-500">
                        Save a named snapshot or restore any previous revision.
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={textVersionName}
                          onChange={(event) =>
                            setTextVersionName(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              void handleSaveTextVersion()
                            }
                          }}
                          placeholder="Name this snapshot..."
                          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-zinc-500"
                          disabled={isSavingTextVersion}
                        />
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 py-2 text-xs font-medium text-zinc-900 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => void handleSaveTextVersion()}
                          disabled={isSavingTextVersion || isLoadingTextVersions}
                        >
                          {isSavingTextVersion ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Save size={12} strokeWidth={1.8} />
                          )}
                          <span>{isSavingTextVersion ? 'Saving' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="p-2">
                      {isLoadingTextVersions ? (
                        <div className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-950 px-3 py-6 text-sm text-zinc-400">
                          <Loader2 size={14} className="animate-spin" />
                          <span>Loading versions...</span>
                        </div>
                      ) : orderedTextVersions.length === 0 ? (
                        <div className="space-y-2">
                          <div className="rounded-lg border border-zinc-800/60 bg-zinc-950 px-2.5 py-2">
                            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                              <span>Oldest</span>
                              <span>0/0</span>
                              <span>Newest</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={0}
                              value={0}
                              disabled
                              className="h-1.5 w-full cursor-not-allowed opacity-45 accent-zinc-200"
                            />
                          </div>
                          <div className="rounded-lg border border-zinc-800/60 bg-zinc-950 px-3 py-4 text-center">
                            <p className="text-xs text-zinc-500">
                              No text versions yet.
                            </p>
                            <p className="mt-1 text-[11px] text-zinc-600">
                              Save a snapshot or keep editing to create auto
                              revisions.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="rounded-lg border border-zinc-800/60 bg-zinc-950 px-2.5 py-2">
                            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-35"
                                onClick={selectPreviousTextVersion}
                                disabled={!canMoveToOlderVersion}
                                title="Select older revision"
                              >
                                <ChevronLeft size={11} strokeWidth={2} />
                                <span>Older</span>
                              </button>
                              <span>
                                {selectedTextVersionIndex + 1}/{totalTextVersions}
                              </span>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-35"
                                onClick={selectNextTextVersion}
                                disabled={!canMoveToNewerVersion}
                                title="Select newer revision"
                              >
                                <span>Newer</span>
                                <ChevronRight size={11} strokeWidth={2} />
                              </button>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={Math.max(totalTextVersions - 1, 0)}
                              value={selectedTextVersionIndex}
                              onChange={(event) =>
                                setSelectedTextVersionIndex(
                                  Number(event.target.value),
                                )
                              }
                              disabled={totalTextVersions < 2}
                              className={`h-1.5 w-full accent-zinc-200 ${
                                totalTextVersions < 2
                                  ? 'cursor-not-allowed opacity-45'
                                  : 'cursor-pointer'
                              }`}
                            />
                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-600">
                              <span className="max-w-[42%] truncate">
                                {orderedTextVersions[0].name}
                              </span>
                              <span className="max-w-[42%] truncate text-right">
                                {orderedTextVersions[totalTextVersions - 1].name}
                              </span>
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-800/60 bg-zinc-950 px-2.5 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="mb-1 inline-flex items-center gap-1.5">
                                  <span
                                    className={`rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
                                      getVersionSource(selectedTextVersion.name) ===
                                      'auto'
                                        ? 'border border-sky-700/50 bg-sky-500/15 text-sky-300'
                                        : 'border border-zinc-700 bg-zinc-800 text-zinc-300'
                                    }`}
                                  >
                                    {getVersionSource(selectedTextVersion.name)}
                                  </span>
                                  <span className="text-[11px] text-zinc-500">
                                    {timeAgo(selectedTextVersion.createdAt)}
                                  </span>
                                </div>
                                <div className="truncate text-sm text-zinc-200">
                                  {selectedTextVersion.name}
                                </div>
                                <div className="mt-0.5 text-[11px] text-zinc-500">
                                  {formatVersionTimestamp(
                                    selectedTextVersion.createdAt,
                                  )}
                                </div>
                              </div>
                            </div>
                            {selectedTextVersion.previewText && (
                              <div className="mt-1.5 max-h-20 overflow-hidden rounded-md border border-zinc-800/60 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-500">
                                {selectedTextVersion.previewText}
                              </div>
                            )}
                            <div className="mt-2 flex justify-end gap-2">
                              {confirmRestoreVersionId === selectedTextVersion._id ? (
                                <>
                                  <button
                                    type="button"
                                    className="cursor-pointer rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                                    onClick={() => setConfirmRestoreVersionId(null)}
                                    disabled={Boolean(restoringTextVersionId)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={handleRestoreSelectedTextVersion}
                                    disabled={Boolean(restoringTextVersionId)}
                                  >
                                    {restoringTextVersionId ===
                                    selectedTextVersion._id ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <RotateCcw size={12} strokeWidth={1.8} />
                                    )}
                                    <span>
                                      {restoringTextVersionId ===
                                      selectedTextVersion._id
                                        ? 'Restoring'
                                        : 'Confirm restore'}
                                    </span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  onClick={() =>
                                    setConfirmRestoreVersionId(
                                      selectedTextVersion._id,
                                    )
                                  }
                                  disabled={Boolean(restoringTextVersionId)}
                                  title="Restore selected version"
                                >
                                  <RotateCcw size={12} strokeWidth={1.8} />
                                  <span>Restore selected</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-zinc-800/60 bg-zinc-950 p-1.5">
                            {orderedTextVersions.map((version, index) => (
                              <button
                                key={version._id}
                                type="button"
                                className={`block w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                                  index === selectedTextVersionIndex
                                    ? 'bg-zinc-800 text-zinc-100'
                                    : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                                }`}
                                onClick={() => setSelectedTextVersionIndex(index)}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="block truncate">{version.name}</span>
                                  <span
                                    className={`rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${
                                      getVersionSource(version.name) === 'auto'
                                        ? 'border border-sky-700/50 bg-sky-500/15 text-sky-300'
                                        : 'border border-zinc-700 bg-zinc-800 text-zinc-300'
                                    }`}
                                  >
                                    {getVersionSource(version.name)}
                                  </span>
                                </div>
                                <span className="mt-0.5 block text-[10px] text-zinc-500">
                                  {formatVersionTimestamp(version.createdAt)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-zinc-700 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                onClick={onClose}
                title="Close workspace"
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/60 bg-zinc-900 px-7 py-3">
            <ToolbarButton
              icon={Undo2}
              label="Undo"
              disabled={!editor?.can().undo()}
              onClick={() => editor?.chain().focus().undo().run()}
            />
            <ToolbarButton
              icon={Redo2}
              label="Redo"
              disabled={!editor?.can().redo()}
              onClick={() => editor?.chain().focus().redo().run()}
            />
            <div className="mx-1 h-6 w-px bg-zinc-700" />
            <ToolbarButton
              icon={Heading1}
              label="Heading 1"
              active={editor?.isActive('heading', { level: 1 })}
              disabled={!editor}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 1 }).run()
              }
            />
            <ToolbarButton
              icon={Heading2}
              label="Heading 2"
              active={editor?.isActive('heading', { level: 2 })}
              disabled={!editor}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            />
            <ToolbarButton
              icon={Bold}
              label="Bold"
              active={editor?.isActive('bold')}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              icon={Italic}
              label="Italic"
              active={editor?.isActive('italic')}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              icon={List}
              label="Bullet List"
              active={editor?.isActive('bulletList')}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              icon={ListOrdered}
              label="Ordered List"
              active={editor?.isActive('orderedList')}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
              icon={TextQuote}
              label="Quote"
              active={editor?.isActive('blockquote')}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            />
            <ToolbarButton
              icon={Code}
              label="Code Block"
              active={editor?.isActive('codeBlock')}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            />
            <ToolbarButton
              icon={Minus}
              label="Divider"
              disabled={!editor}
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            />
            <ToolbarButton
              icon={Sparkles}
              label="Generate Image"
              active={showMediaComposer}
              disabled={!editor || !selectedImageModelId || isGeneratingImage}
              onClick={(event) => {
                const selectedText = editor
                  ?.state.doc.textBetween(
                    editor.state.selection.from,
                    editor.state.selection.to,
                    '\n\n',
                  )
                  .trim()
                const triggerBounds = event.currentTarget.getBoundingClientRect()
                openMediaComposer({
                  prompt: selectedText || mediaPrompt,
                  anchor: {
                    source: 'toolbar',
                    x: triggerBounds.right,
                    y: triggerBounds.bottom,
                    align: 'end',
                  },
                })
              }}
            />
            <ToolbarButton
              icon={
                uploadState.status === 'uploading' ||
                uploadState.status === 'processing'
                  ? Loader2
                  : ImagePlus
              }
              label="Upload Image"
              disabled={
                !editor ||
                uploadState.status === 'uploading' ||
                uploadState.status === 'processing'
              }
              onClick={() => fileInputRef.current?.click()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>

          <div
            ref={editorScrollRef}
            className="relative min-h-0 flex-1 overflow-auto bg-zinc-900 px-5 py-6 sm:px-7 sm:py-8"
          >
            {(mediaError || helperError || exportError || textVersionError) && (
              <div className="sticky top-0 z-20 mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-3 text-sm text-red-200 backdrop-blur">
                {exportError || textVersionError || helperError || mediaError}
              </div>
            )}
            {showMediaComposer && (
              <div
                ref={mediaComposerRef}
                className="fixed z-[10001] w-[min(28rem,calc(100vw-1.5rem))] rounded-xl border border-zinc-800/60 bg-zinc-900 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.45)] backdrop-blur"
                style={{ left: mediaComposerLeft, top: mediaComposerTop }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">
                      Generate image
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Create media from your document or selected text and
                      insert it into the page.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                    onClick={closeMediaComposer}
                    disabled={isGeneratingImage}
                    title="Close image generator"
                  >
                    <X size={14} strokeWidth={1.8} />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                      Prompt
                    </div>
                    <textarea
                      value={mediaPrompt}
                      onChange={(event) => setMediaPrompt(event.target.value)}
                      placeholder="Describe the image you want to generate..."
                      className="min-h-28 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-zinc-500"
                      disabled={isGeneratingImage}
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                      Model
                    </div>
                    <select
                      value={selectedImageModelId}
                      onChange={(event) =>
                        setSelectedImageModelId(event.target.value)
                      }
                      className="w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-zinc-500"
                      disabled={isGeneratingImage}
                    >
                      {(imageModels ?? []).map((model) => (
                        <option key={model._id} value={model.falId}>
                          {model.name} · {model.provider}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                      onClick={() => {
                        const selectedText = editor
                          ?.state.doc.textBetween(
                            editor.state.selection.from,
                            editor.state.selection.to,
                            '\n\n',
                          )
                          .trim()
                        if (selectedText) {
                          setMediaPrompt(selectedText)
                        }
                      }}
                      disabled={isGeneratingImage}
                    >
                      Use selected text
                    </button>
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage || !selectedImageModelId}
                    >
                      {isGeneratingImage && (
                        <Loader2 size={14} className="animate-spin" />
                      )}
                      <span>
                        {isGeneratingImage ? 'Generating...' : 'Generate'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="min-h-full w-full rounded-xl border border-zinc-800/60 bg-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
              <EditorContent
                editor={editor}
                className="h-full min-h-[calc(100vh-15rem)] w-full [&_.tiptap]:h-full [&_.tiptap]:w-full"
              />
            </div>
            {isRunningTextHelper && pendingTextHelper && (
              <div
                className="pointer-events-none fixed z-[10003] inline-flex h-11 w-[248px] items-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900 px-3 text-sm text-zinc-200 shadow-[0_2px_10px_rgba(0,0,0,0.45)] backdrop-blur animate-[fadeSlideIn_180ms_ease-out]"
                style={{ left: helperStatusLeft, top: helperStatusTop }}
              >
                <Loader2 size={14} className="animate-spin text-zinc-400" />
                <span>{pendingTextHelper.actionLabel} in progress...</span>
              </div>
            )}
            {selectionMenu &&
              !showMediaComposer &&
              !slashMenu &&
              !isRunningTextHelper && (
              <div
                ref={selectionMenuRef}
                className="fixed z-[10002] flex max-w-[428px] flex-wrap items-center gap-1.5 rounded-xl border border-zinc-800/60 bg-zinc-900 p-2 shadow-[0_2px_10px_rgba(0,0,0,0.45)] backdrop-blur animate-[fadeSlideIn_180ms_ease-out]"
                style={{ left: selectionLeft, top: selectionTop }}
              >
                {SELECTION_HELPER_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      void runTextHelper(action.id)
                    }}
                  >
                    {action.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    openMediaComposer({
                      prompt: selectionMenu.text,
                      anchor: {
                        source: 'selection-menu',
                        x: selectionMenu.x,
                        y: selectionMenu.selectionBottom,
                        align: 'center',
                      },
                    })
                  }}
                >
                  <Sparkles size={14} strokeWidth={1.8} />
                  <span>Image</span>
                </button>
              </div>
            )}
            {slashMenu && filteredSlashCommands.length > 0 && (
              <div
                ref={slashMenuRef}
                className="fixed z-[10000] w-72 overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.45)] animate-[fadeSlideIn_180ms_ease-out]"
                style={{ left: slashLeft, top: slashTop }}
              >
                <div className="border-b border-zinc-700 px-3 py-2 text-xs text-zinc-500">
                  Commands
                </div>
                <div className="max-h-72 overflow-auto py-1.5">
                  {filteredSlashCommands.map((command) => (
                    <button
                      key={command.id}
                      type="button"
                      className="flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        runSlashCommand(command.id)
                      }}
                    >
                      {command.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 border-l border-zinc-800/60 bg-zinc-900">
          <AgentPanel
            {...agentPanelProps}
            onClose={onClose}
            variant="embedded"
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
