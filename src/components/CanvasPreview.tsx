import type { NodeContentType } from '@/types/nodes'

const CONTENT_TYPE_COLORS: Record<string, string> = {
  image: '#60a5fa',
  text: '#a1a1aa',
  video: '#a78bfa',
  audio: '#f472b6',
  music: '#f472b6',
  note: '#fbbf24',
  ticket: '#fb923c',
  pdf: '#34d399',
}

type MinimalNode = {
  id: string
  position: { x: number; y: number }
  data?: { contentType?: NodeContentType }
}

type MinimalEdge = {
  id?: string
  source: string
  target: string
}

const NODE_W = 120
const NODE_H = 60
const PAD = 40

function SvgFallback({
  nodes,
  edges,
}: {
  nodes: Array<MinimalNode>
  edges: Array<MinimalEdge>
}) {
  if (!nodes.length) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-[9px] text-zinc-700">Empty canvas</span>
      </div>
    )
  }

  const xs = nodes.map((n) => n.position.x)
  const ys = nodes.map((n) => n.position.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs) + NODE_W
  const maxY = Math.max(...ys) + NODE_H

  const vw = maxX - minX + PAD * 2
  const vh = maxY - minY + PAD * 2

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
    >
      {edges.map((edge, i) => {
        const src = nodeMap.get(edge.source)
        const tgt = nodeMap.get(edge.target)
        if (!src || !tgt) return null
        const x1 = src.position.x - minX + PAD + NODE_W
        const y1 = src.position.y - minY + PAD + NODE_H / 2
        const x2 = tgt.position.x - minX + PAD
        const y2 = tgt.position.y - minY + PAD + NODE_H / 2
        return (
          <line
            key={edge.id ?? i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#3f3f46"
            strokeWidth={2}
          />
        )
      })}
      {nodes.map((node) => {
        const x = node.position.x - minX + PAD
        const y = node.position.y - minY + PAD
        const color =
          CONTENT_TYPE_COLORS[node.data?.contentType ?? ''] ?? '#52525b'
        return (
          <rect
            key={node.id}
            x={x}
            y={y}
            width={NODE_W}
            height={NODE_H}
            rx={8}
            fill={color}
            opacity={0.6}
          />
        )
      })}
    </svg>
  )
}

export default function CanvasPreview({
  thumbnailUrl,
  nodes,
  edges,
}: {
  thumbnailUrl?: string | null
  nodes: Array<MinimalNode>
  edges: Array<MinimalEdge>
}) {
  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt="Canvas preview"
        className="w-full h-full object-cover"
        loading="lazy"
      />
    )
  }

  return <SvgFallback nodes={nodes} edges={edges} />
}
