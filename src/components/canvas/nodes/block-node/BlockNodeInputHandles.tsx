import { Fragment } from 'react'
import { Handle, Position } from '@xyflow/react'

import type { PortType } from '@/types/nodes'
import { PORT_TYPE_COLORS } from '@/types/nodes'

type BlockNodeInputHandlesProps = {
  connectedInputTypes: Array<PortType>
  isVisible: boolean
  mediaInputTypes: Array<PortType>
}

export default function BlockNodeInputHandles({
  connectedInputTypes,
  isVisible,
  mediaInputTypes,
}: BlockNodeInputHandlesProps) {
  if (!isVisible) return null

  const allInputHandles: Array<{ type: PortType; label: string }> = [
    { type: 'text', label: 'Prompt' },
    ...mediaInputTypes.map((type) => ({
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
    })),
  ]

  return allInputHandles.map((handle, index) => {
    const total = allInputHandles.length
    const isConnected = connectedInputTypes.includes(handle.type)
    const yPercent = total === 1 ? 50 : ((index + 1) / (total + 1)) * 100

    return (
      <Fragment key={`input-${handle.type}`}>
        <Handle
          id={`input-${handle.type}`}
          type="target"
          position={Position.Left}
          style={{
            top: `${yPercent}%`,
            background: isConnected ? PORT_TYPE_COLORS[handle.type] : '#71717a',
            width: 10,
            height: 10,
            border: '2px solid #27272a',
          }}
        />
        <span
          className="absolute pointer-events-none whitespace-nowrap text-[9px]"
          style={{
            right: '100%',
            marginRight: 8,
            top: `${yPercent}%`,
            transform: 'translateY(-50%)',
            color: isConnected ? PORT_TYPE_COLORS[handle.type] : '#71717a',
          }}
        >
          {handle.label}
        </span>
      </Fragment>
    )
  })
}
