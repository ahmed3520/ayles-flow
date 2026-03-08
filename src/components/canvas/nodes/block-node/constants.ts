import {
  FileText,
  Globe,
  Image,
  Mic,
  Monitor,
  Music,
  Smartphone,
  StickyNote,
  Tablet,
  Ticket,
  Type,
  Video,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { NodeContentType, PortType } from '@/types/nodes'
import type { UploadContentCategory } from '@/types/uploads'

export const VIEWPORT_PRESETS = {
  desktop: { width: 640, icon: Monitor },
  tablet: { width: 480, icon: Tablet },
  mobile: { width: 375, icon: Smartphone },
} as const

export type ViewportPreset = keyof typeof VIEWPORT_PRESETS

export type ContentTypeConfigEntry = {
  icon: LucideIcon
  label: string
  placeholder: string
}

export const CONTENT_TYPE_CONFIG: Record<
  NodeContentType,
  ContentTypeConfigEntry
> = {
  image: { icon: Image, label: 'Image', placeholder: 'Generate an image' },
  text: { icon: Type, label: 'Text', placeholder: 'Generate text' },
  video: { icon: Video, label: 'Video', placeholder: 'Generate a video' },
  audio: { icon: Mic, label: 'Audio', placeholder: 'Generate audio' },
  music: { icon: Music, label: 'Music', placeholder: 'Generate music' },
  note: {
    icon: StickyNote,
    label: 'Note',
    placeholder: 'Write your note...',
  },
  ticket: {
    icon: Ticket,
    label: 'Ticket',
    placeholder: 'Describe the task...',
  },
  pdf: {
    icon: FileText,
    label: 'PDF',
    placeholder: 'Upload a PDF document',
  },
  website: {
    icon: Globe,
    label: 'Website',
    placeholder: 'Live preview',
  },
}

export const REPLACE_ACCEPT_BY_TYPE: Partial<Record<NodeContentType, string>> =
  {
    image: 'image/jpeg,image/png,image/webp,image/gif',
    video: 'video/mp4,video/webm,video/quicktime',
    audio: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4',
    music: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4',
    pdf: 'application/pdf',
  }

export const UPLOAD_CATEGORY_BY_TYPE: Partial<
  Record<NodeContentType, UploadContentCategory>
> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  music: 'audio',
  pdf: 'pdf',
}

export const TICKET_STATUSES = ['todo', 'doing', 'done'] as const

export const TICKET_STATUS_CONFIG = {
  todo: { label: 'To Do', bg: 'bg-violet-500/15', text: 'text-violet-400' },
  doing: { label: 'Doing', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  done: { label: 'Done', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
} as const

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const

export const TICKET_PRIORITY_CONFIG = {
  low: { label: 'Low', bg: 'bg-zinc-700', text: 'text-zinc-400' },
  normal: { label: 'Normal', bg: 'bg-zinc-700', text: 'text-zinc-400' },
  high: { label: 'High', bg: 'bg-orange-500/15', text: 'text-orange-400' },
  urgent: { label: 'Urgent', bg: 'bg-red-500/15', text: 'text-red-400' },
} as const

export const TICKET_TAGS = [
  { value: '', label: 'No tag', color: 'bg-zinc-600' },
  { value: 'feature', label: 'Feature', color: 'bg-blue-500' },
  { value: 'bug', label: 'Bug', color: 'bg-red-500' },
  { value: 'design', label: 'Design', color: 'bg-pink-500' },
  { value: 'refactor', label: 'Refactor', color: 'bg-amber-500' },
  { value: 'docs', label: 'Docs', color: 'bg-emerald-500' },
] as const

export const NOTE_COLORS = [
  'yellow',
  'green',
  'blue',
  'pink',
  'purple',
] as const

export const NOTE_COLOR_CONFIG = {
  yellow: {
    bg: '#fef3c7',
    text: '#78350f',
    lines: 'rgba(180,140,50,0.08)',
    fold: 'rgba(180,140,50,0.12)',
    dot: '#fbbf24',
    accent: '#d97706',
    ring: '#fbbf24',
    toolbar: '#fef3c7',
    toolbarBorder: '#fde68a',
  },
  green: {
    bg: '#d1fae5',
    text: '#064e3b',
    lines: 'rgba(50,140,80,0.08)',
    fold: 'rgba(50,140,80,0.12)',
    dot: '#34d399',
    accent: '#059669',
    ring: '#34d399',
    toolbar: '#d1fae5',
    toolbarBorder: '#6ee7b7',
  },
  blue: {
    bg: '#e0f2fe',
    text: '#0c4a6e',
    lines: 'rgba(50,100,180,0.08)',
    fold: 'rgba(50,100,180,0.12)',
    dot: '#38bdf8',
    accent: '#0284c7',
    ring: '#38bdf8',
    toolbar: '#e0f2fe',
    toolbarBorder: '#7dd3fc',
  },
  pink: {
    bg: '#fce7f3',
    text: '#831843',
    lines: 'rgba(180,50,100,0.08)',
    fold: 'rgba(180,50,100,0.12)',
    dot: '#f472b6',
    accent: '#db2777',
    ring: '#f472b6',
    toolbar: '#fce7f3',
    toolbarBorder: '#f9a8d4',
  },
  purple: {
    bg: '#ede9fe',
    text: '#3b0764',
    lines: 'rgba(120,50,180,0.08)',
    fold: 'rgba(120,50,180,0.12)',
    dot: '#a78bfa',
    accent: '#7c3aed',
    ring: '#a78bfa',
    toolbar: '#ede9fe',
    toolbarBorder: '#c4b5fd',
  },
} as const

export type NoteTheme =
  (typeof NOTE_COLOR_CONFIG)[keyof typeof NOTE_COLOR_CONFIG]

export type ImageToolActionState = 'remove_background' | 'upscale' | null

export const CONTENT_TO_PORT: Record<NodeContentType, PortType> = {
  image: 'image',
  text: 'text',
  video: 'video',
  audio: 'audio',
  music: 'audio',
  note: 'text',
  ticket: 'text',
  pdf: 'pdf',
  website: 'text',
}
