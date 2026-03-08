import type { ReactNode } from 'react'

type ToolbarHintProps = {
  label: string
  show: boolean
  children: ReactNode
}

export default function ToolbarHint({
  label,
  show,
  children,
}: ToolbarHintProps) {
  return (
    <span className="relative">
      {show && (
        <span className="absolute -top-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[9px] text-zinc-300 pointer-events-none">
          {label}
        </span>
      )}
      {children}
    </span>
  )
}
