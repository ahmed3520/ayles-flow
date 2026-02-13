import {
  formatCanvasStateResponse,
  formatModelsResponse,
  initVirtualState,
} from '../src/data/agent-config'

import type { AvailableModel, CanvasEdge, CanvasNode } from '../src/types/agent'
import type { VirtualState } from '../src/data/agent-config'

// --- Full model list (from SEED_MODELS in convex/models.ts) ---

export const AVAILABLE_MODELS: Array<AvailableModel> = [
  // Text-to-image
  { falId: 'fal-ai/imagen4/preview', name: 'Imagen 4', provider: 'Google', contentType: 'image', inputs: [{ name: 'Prompt', type: 'text', required: true }], outputType: 'image' },
  { falId: 'fal-ai/flux-pro/v1.1-ultra', name: 'FLUX 1.1 Pro Ultra', provider: 'Black Forest Labs', contentType: 'image', inputs: [{ name: 'Prompt', type: 'text', required: true }], outputType: 'image' },
  { falId: 'fal-ai/recraft/v3/text-to-image', name: 'Recraft V3', provider: 'Recraft', contentType: 'image', inputs: [{ name: 'Prompt', type: 'text', required: true }], outputType: 'image' },
  { falId: 'fal-ai/hidream-i1-full', name: 'HiDream I1 Full', provider: 'HiDream', contentType: 'image', inputs: [{ name: 'Prompt', type: 'text', required: true }], outputType: 'image' },
  { falId: 'fal-ai/gpt-image-1/text-to-image', name: 'GPT Image 1', provider: 'OpenAI', contentType: 'image', inputs: [{ name: 'Prompt', type: 'text', required: true }], outputType: 'image' },
  { falId: 'fal-ai/flux-1/schnell', name: 'FLUX.1 [schnell]', provider: 'Black Forest Labs', contentType: 'image', inputs: [{ name: 'Prompt', type: 'text', required: true }], outputType: 'image' },
  // Image-to-image
  { falId: 'fal-ai/flux-2', name: 'FLUX.2 [dev]', provider: 'Black Forest Labs', contentType: 'image', inputs: [{ name: 'Prompt', type: 'text', required: true }, { name: 'Image', type: 'image', required: false }], outputType: 'image' },
  { falId: 'fal-ai/ideogram/v3', name: 'Ideogram V3', provider: 'Ideogram', contentType: 'image', inputs: [{ name: 'Prompt', type: 'text', required: true }, { name: 'Image', type: 'image', required: false }], outputType: 'image' },
  { falId: 'fal-ai/flux/dev', name: 'FLUX.1 [dev]', provider: 'Black Forest Labs', contentType: 'image', inputs: [{ name: 'Prompt', type: 'text', required: true }], outputType: 'image' },
  { falId: 'fal-ai/flux-pro/kontext', name: 'FLUX.1 [kontext]', provider: 'Black Forest Labs', contentType: 'image', inputs: [{ name: 'Prompt', type: 'text', required: true }, { name: 'Image', type: 'image', required: false }], outputType: 'image' },
  { falId: 'fal-ai/stable-diffusion-v3-medium/image-to-image', name: 'SD 3.5 Medium', provider: 'Stability AI', contentType: 'image', inputs: [{ name: 'Prompt', type: 'text', required: true }, { name: 'Image', type: 'image', required: false }], outputType: 'image' },
  // Text-to-video
  { falId: 'fal-ai/kling-video/v2.1/master/text-to-video', name: 'Kling 2.1 Master', provider: 'Kling', contentType: 'video', inputs: [{ name: 'Prompt', type: 'text', required: true }], outputType: 'video' },
  { falId: 'fal-ai/minimax/video-01', name: 'MiniMax Video-01', provider: 'MiniMax', contentType: 'video', inputs: [{ name: 'Prompt', type: 'text', required: true }], outputType: 'video' },
  { falId: 'fal-ai/minimax/hailuo-02/pro/text-to-video', name: 'Hailuo-02 Pro', provider: 'MiniMax', contentType: 'video', inputs: [{ name: 'Prompt', type: 'text', required: true }], outputType: 'video' },
  // Image-to-video
  { falId: 'fal-ai/kling-video/v2.1/master/image-to-video', name: 'Kling 2.1 Master (I2V)', provider: 'Kling', contentType: 'video', inputs: [{ name: 'Prompt', type: 'text', required: true }, { name: 'Image', type: 'image', required: true }], outputType: 'video' },
  { falId: 'fal-ai/minimax/video-01-live/image-to-video', name: 'MiniMax Video-01 (I2V)', provider: 'MiniMax', contentType: 'video', inputs: [{ name: 'Prompt', type: 'text', required: true }, { name: 'Image', type: 'image', required: true }], outputType: 'video' },
  { falId: 'fal-ai/minimax/hailuo-02/pro/image-to-video', name: 'Hailuo-02 Pro (I2V)', provider: 'MiniMax', contentType: 'video', inputs: [{ name: 'Prompt', type: 'text', required: true }, { name: 'Image', type: 'image', required: true }], outputType: 'video' },
  // Audio/TTS
  { falId: 'fal-ai/orpheus-tts', name: 'Orpheus TTS', provider: 'Orpheus', contentType: 'audio', inputs: [{ name: 'Text', type: 'text', required: true }], outputType: 'audio' },
  { falId: 'fal-ai/elevenlabs/tts/eleven-v3', name: 'ElevenLabs V3', provider: 'ElevenLabs', contentType: 'audio', inputs: [{ name: 'Text', type: 'text', required: true }], outputType: 'audio' },
  { falId: 'fal-ai/chatterbox/text-to-speech', name: 'Chatterbox', provider: 'Chatterbox', contentType: 'audio', inputs: [{ name: 'Text', type: 'text', required: true }, { name: 'Voice Clone Audio', type: 'audio', required: false }], outputType: 'audio' },
  // Music
  { falId: 'fal-ai/minimax-music', name: 'MiniMax Music', provider: 'MiniMax', contentType: 'music', inputs: [{ name: 'Prompt', type: 'text', required: true }, { name: 'Reference Audio', type: 'audio', required: false }], outputType: 'audio' },
  { falId: 'fal-ai/lyria2', name: 'Lyria 2', provider: 'Google', contentType: 'music', inputs: [{ name: 'Prompt', type: 'text', required: true }], outputType: 'audio' },
  { falId: 'cassetteai/music-generator', name: 'CassetteAI', provider: 'CassetteAI', contentType: 'music', inputs: [{ name: 'Prompt', type: 'text', required: true }], outputType: 'audio' },
]

// --- Mock tool executor ---

export class MockToolExecutor {
  private state: VirtualState

  constructor(initialNodes: Array<CanvasNode>, initialEdges: Array<CanvasEdge>) {
    this.state = initVirtualState(initialNodes, initialEdges)
  }

  execute(name: string, args: Record<string, unknown>): string {
    switch (name) {
      case 'get_canvas_state':
        return formatCanvasStateResponse(this.state)

      case 'get_available_models':
        return formatModelsResponse(
          AVAILABLE_MODELS,
          args.contentType as string | undefined,
        )

      case 'add_node': {
        const nodeId = `node-${this.state.nextNodeId++}`
        const contentType = (args.contentType as string) || 'image'
        const lastNode = this.state.nodes.at(-1)
        const x = (args.x as number | undefined) ?? (lastNode ? lastNode.x + 300 : 100)
        const y = (args.y as number | undefined) ?? (lastNode ? lastNode.y : 100)

        this.state.nodes.push({
          id: nodeId,
          contentType: contentType as CanvasNode['contentType'],
          label: (args.label as string) || `New ${contentType} block`,
          prompt: (args.prompt as string) || '',
          model: (args.model as string) || '',
          generationStatus: 'idle',
          x,
          y,
        })
        return JSON.stringify({ nodeId, success: true })
      }

      case 'connect_nodes': {
        const sourceId = args.sourceNodeId as string
        const targetId = args.targetNodeId as string
        const portType = args.portType as string

        const source = this.state.nodes.find((n) => n.id === sourceId)
        const target = this.state.nodes.find((n) => n.id === targetId)
        if (!source) return JSON.stringify({ error: `Source node ${sourceId} not found` })
        if (!target) return JSON.stringify({ error: `Target node ${targetId} not found` })

        const edgeId = `edge-agent-${this.state.nextEdgeId++}`
        this.state.edges.push({
          id: edgeId,
          source: sourceId,
          target: targetId,
          sourceHandle: `output-${portType}`,
          targetHandle: `input-${portType}`,
        })
        return JSON.stringify({ edgeId, success: true })
      }

      case 'update_node': {
        const nodeId = args.nodeId as string
        const node = this.state.nodes.find((n) => n.id === nodeId)
        if (!node) return JSON.stringify({ error: `Node ${nodeId} not found` })
        if (args.prompt !== undefined) node.prompt = args.prompt as string
        if (args.model !== undefined) node.model = args.model as string
        if (args.label !== undefined) node.label = args.label as string
        return JSON.stringify({ success: true })
      }

      case 'delete_nodes': {
        const nodeIds = args.nodeIds as Array<string>
        const idSet = new Set(nodeIds)
        const before = this.state.nodes.length
        this.state.nodes = this.state.nodes.filter((n) => !idSet.has(n.id))
        this.state.edges = this.state.edges.filter(
          (e) => !idSet.has(e.source) && !idSet.has(e.target),
        )
        return JSON.stringify({ deletedCount: before - this.state.nodes.length })
      }

      case 'clear_canvas':
        this.state.nodes = []
        this.state.edges = []
        this.state.nextNodeId = 1
        this.state.nextEdgeId = 1
        return JSON.stringify({ success: true })

      case 'web_search':
        return `Search results for "${args.query}":\n\nMock search result about ${args.query}. Covers recent developments, key findings, and expert opinions.\n\nSources:\n- [Wikipedia](https://en.wikipedia.org/wiki/${encodeURIComponent(String(args.query))})`

      case 'deep_research': {
        const topic = args.topic as string
        const nodeId = `node-${this.state.nextNodeId++}`
        const lastNode = this.state.nodes.at(-1)
        const x = (args.x as number | undefined) ?? (lastNode ? lastNode.x + 300 : 100)
        const y = (args.y as number | undefined) ?? (lastNode ? lastNode.y : 100)
        const markdown = `# Research: ${topic}\n\n## Executive Summary\nComprehensive research about ${topic}.\n\n## Key Findings\n- Finding 1 about ${topic}\n- Finding 2 about ${topic}\n- Finding 3 about ${topic}\n\n## Analysis\nDetailed analysis of ${topic} based on multiple sources.\n\n## Sources\n[1] Source One\n[2] Source Two\n[3] Source Three`

        this.state.nodes.push({
          id: nodeId,
          contentType: 'note',
          label: `Research: ${topic}`,
          prompt: markdown,
          model: '',
          generationStatus: 'idle',
          x,
          y,
        })

        return JSON.stringify({
          success: true,
          noteNodeId: nodeId,
          title: `Research: ${topic}`,
          summary: `Comprehensive research about ${topic}`,
          sourceCount: 3,
          markdown,
        })
      }

      case 'create_pdf':
        return JSON.stringify({ success: true, message: 'PDF creation initiated on client' })

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  }
}
