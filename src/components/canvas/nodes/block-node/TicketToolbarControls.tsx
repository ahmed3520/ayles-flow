import { Send } from 'lucide-react'

import ToolbarHint from './ToolbarHint'
import type { Dispatch, SetStateAction } from 'react'

type TicketToolbarControlsProps = {
  hoveredHint: string | null
  id: string
  sendTicketToAgent: () => void
  setHoveredHint: Dispatch<SetStateAction<string | null>>
}

export default function TicketToolbarControls({
  hoveredHint,
  id,
  sendTicketToAgent,
  setHoveredHint,
}: TicketToolbarControlsProps) {
  return (
    <>
      <div className="h-1.5 w-1.5 rounded-full bg-violet-500" />
      <span className="font-mono text-[10px] font-medium tracking-wider text-violet-400/90 uppercase">
        Ticket
      </span>
      <span className="font-mono text-[9px] text-zinc-500">
        #{id.slice(-4).toUpperCase()}
      </span>
      <div className="h-3.5 w-px bg-zinc-700/50" />
      <ToolbarHint label="Send to agent" show={hoveredHint === 'ticket-send'}>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-md text-violet-400/70 transition-colors hover:bg-violet-500/10 hover:text-violet-300"
          title="Send to agent"
          onMouseEnter={() => setHoveredHint('ticket-send')}
          onMouseLeave={() => setHoveredHint(null)}
          onClick={sendTicketToAgent}
        >
          <Send size={13} />
        </button>
      </ToolbarHint>
    </>
  )
}
