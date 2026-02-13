import { AVAILABLE_MODELS } from './mocks'

import type { CanvasEdge, CanvasNode } from '../src/types/agent'
import type { Scenario } from './types'

// --- Model category helpers ---

const TEXT_TO_IMAGE_IDS = AVAILABLE_MODELS
  .filter((m) => m.contentType === 'image' && !m.inputs.some((i) => i.type === 'image'))
  .map((m) => m.falId)

const IMAGE_TO_IMAGE_IDS = AVAILABLE_MODELS
  .filter((m) => m.contentType === 'image' && m.inputs.some((i) => i.type === 'image'))
  .map((m) => m.falId)

const IMAGE_TO_VIDEO_IDS = AVAILABLE_MODELS
  .filter((m) => m.contentType === 'video' && m.inputs.some((i) => i.type === 'image' && i.required))
  .map((m) => m.falId)

const MUSIC_IDS = AVAILABLE_MODELS
  .filter((m) => m.contentType === 'music')
  .map((m) => m.falId)

const AUDIO_IDS = AVAILABLE_MODELS
  .filter((m) => m.contentType === 'audio')
  .map((m) => m.falId)

const isOneOf = (ids: Array<string>) => (val: unknown) =>
  typeof val === 'string' && ids.includes(val)

// --- Canvas fixtures ---

const EMPTY_CANVAS: { nodes: Array<CanvasNode>; edges: Array<CanvasEdge> } = { nodes: [], edges: [] }

const CANVAS_COMPLETED_IMAGE: { nodes: Array<CanvasNode>; edges: Array<CanvasEdge> } = {
  nodes: [
    {
      id: 'node-1',
      contentType: 'image',
      label: 'Cat Photo',
      prompt: 'a photo of a cat sitting on a windowsill',
      model: 'fal-ai/flux-pro/v1.1-ultra',
      generationStatus: 'completed',
      resultUrl: 'https://fal.media/files/example/cat.jpg',
      x: 100,
      y: 100,
    },
  ],
  edges: [],
}

const CANVAS_THREE_NODES: { nodes: Array<CanvasNode>; edges: Array<CanvasEdge> } = {
  nodes: [
    {
      id: 'node-1',
      contentType: 'image',
      label: 'Landscape',
      prompt: 'beautiful mountain landscape',
      model: 'fal-ai/flux-pro/v1.1-ultra',
      generationStatus: 'completed',
      resultUrl: 'https://fal.media/files/example/landscape.jpg',
      x: 100,
      y: 100,
    },
    {
      id: 'node-2',
      contentType: 'video',
      label: 'Nature Video',
      prompt: 'flowing river animation',
      model: 'fal-ai/kling-video/v2.1/master/text-to-video',
      generationStatus: 'completed',
      resultUrl: 'https://fal.media/files/example/nature.mp4',
      x: 400,
      y: 100,
    },
    {
      id: 'node-3',
      contentType: 'image',
      label: 'Portrait',
      prompt: 'portrait photography',
      model: 'fal-ai/flux-pro/v1.1-ultra',
      generationStatus: 'completed',
      resultUrl: 'https://fal.media/files/example/portrait.jpg',
      x: 100,
      y: 300,
    },
  ],
  edges: [],
}

// --- Scenarios ---

export const scenarios: Array<Scenario> = [
  // ═══ Simple Generation ═══
  {
    id: 'simple-sunset-image',
    category: 'Simple Generation',
    name: 'Sunset image',
    userMessage: 'Generate a photo of a sunset over the ocean',
    canvasState: EMPTY_CANVAS,
    expectation: {
      expectedToolCalls: [
        { name: 'get_canvas_state', optional: true },
        { name: 'get_available_models', optional: true },
        {
          name: 'add_node',
          args: {
            contentType: 'image',
            model: isOneOf(TEXT_TO_IMAGE_IDS),
            prompt: (v: unknown) => typeof v === 'string' && v.length > 10,
          },
        },
      ],
      forbiddenTools: ['update_node', 'delete_nodes', 'clear_canvas', 'connect_nodes'],
    },
  },
  {
    id: 'simple-lofi-music',
    category: 'Simple Generation',
    name: 'Lo-fi music',
    userMessage: 'Create a lo-fi hip hop beat',
    canvasState: EMPTY_CANVAS,
    expectation: {
      expectedToolCalls: [
        { name: 'get_available_models', optional: true },
        {
          name: 'add_node',
          args: {
            contentType: 'music',
            model: isOneOf(MUSIC_IDS),
          },
        },
      ],
      forbiddenTools: ['update_node', 'delete_nodes', 'clear_canvas'],
    },
  },
  {
    id: 'simple-tts',
    category: 'Simple Generation',
    name: 'TTS poem',
    userMessage: 'Generate a TTS reading of this poem: Roses are red, violets are blue, the sun is bright, and so are you.',
    canvasState: EMPTY_CANVAS,
    expectation: {
      expectedToolCalls: [
        { name: 'get_available_models', optional: true },
        {
          name: 'add_node',
          args: {
            contentType: 'audio',
            model: isOneOf(AUDIO_IDS),
          },
        },
      ],
      forbiddenTools: ['update_node', 'delete_nodes', 'clear_canvas'],
    },
  },

  // ═══ Edit Workflow ═══
  {
    id: 'edit-watercolor',
    category: 'Edit Workflow',
    name: 'Watercolor edit',
    userMessage: 'Make it look like a watercolor painting',
    canvasState: CANVAS_COMPLETED_IMAGE,
    expectation: {
      expectedToolCalls: [
        { name: 'get_canvas_state', optional: true },
        { name: 'get_available_models', optional: true },
        {
          name: 'add_node',
          args: {
            contentType: 'image',
            model: isOneOf(IMAGE_TO_IMAGE_IDS),
          },
        },
        {
          name: 'connect_nodes',
          args: {
            sourceNodeId: 'node-1',
            portType: 'image',
          },
        },
      ],
      forbiddenTools: ['update_node'],
    },
  },
  {
    id: 'edit-animate',
    category: 'Edit Workflow',
    name: 'Animate image',
    userMessage: 'Animate the cat image into a short video',
    canvasState: CANVAS_COMPLETED_IMAGE,
    expectation: {
      expectedToolCalls: [
        { name: 'get_canvas_state', optional: true },
        { name: 'get_available_models', optional: true },
        {
          name: 'add_node',
          args: {
            contentType: 'video',
            model: isOneOf(IMAGE_TO_VIDEO_IDS),
          },
        },
        {
          name: 'connect_nodes',
          args: {
            sourceNodeId: 'node-1',
            portType: 'image',
          },
        },
      ],
      forbiddenTools: ['update_node'],
    },
  },

  // ═══ Multi-step Pipeline ═══
  {
    id: 'pipeline-cyberpunk',
    category: 'Multi-step Pipeline',
    name: 'Cyberpunk chain',
    userMessage: 'Create a cyberpunk city, then make a neon version, then animate it',
    canvasState: EMPTY_CANVAS,
    expectation: {
      expectedToolCalls: [
        { name: 'get_available_models', optional: true },
        { name: 'add_node', args: { contentType: 'image' } },
        { name: 'add_node', args: { contentType: 'image' } },
        { name: 'connect_nodes', args: { portType: 'image' } },
        { name: 'add_node', args: { contentType: 'video' } },
        { name: 'connect_nodes', args: { portType: 'image' } },
      ],
      forbiddenTools: ['update_node', 'delete_nodes'],
      customValidator: (result) => {
        const addNodes = result.allToolCalls.filter((tc) => tc.name === 'add_node')
        const connects = result.allToolCalls.filter((tc) => tc.name === 'connect_nodes')
        if (addNodes.length === 3 && connects.length === 2) {
          return { score: 1, reason: 'Correct 3-node chain with 2 connections' }
        }
        return {
          score: addNodes.length >= 3 && connects.length >= 2 ? 0.8 : 0.5,
          reason: `Got ${addNodes.length} add_node and ${connects.length} connect_nodes (expected 3 and 2)`,
        }
      },
    },
  },

  // ═══ Canvas Management ═══
  {
    id: 'manage-delete-videos',
    category: 'Canvas Management',
    name: 'Delete video nodes',
    userMessage: 'Delete all video nodes',
    canvasState: CANVAS_THREE_NODES,
    expectation: {
      expectedToolCalls: [
        { name: 'get_canvas_state' },
        {
          name: 'delete_nodes',
          args: {
            nodeIds: (v: unknown) =>
              Array.isArray(v) && v.includes('node-2') && v.length === 1,
          },
        },
      ],
      forbiddenTools: ['add_node', 'clear_canvas'],
    },
  },
  {
    id: 'manage-clear-all',
    category: 'Canvas Management',
    name: 'Clear canvas',
    userMessage: 'Clear everything',
    canvasState: CANVAS_THREE_NODES,
    expectation: {
      expectedToolCalls: [
        { name: 'clear_canvas' },
      ],
      forbiddenTools: ['delete_nodes'],
    },
  },

  // ═══ Model Selection ═══
  {
    id: 'model-cheapest',
    category: 'Model Selection',
    name: 'Cheapest image model',
    userMessage: 'Generate a simple landscape photo of rolling hills. Use the fastest and cheapest model you have.',
    canvasState: EMPTY_CANVAS,
    expectation: {
      expectedToolCalls: [
        { name: 'get_available_models' },
        {
          name: 'add_node',
          args: {
            contentType: 'image',
            model: 'fal-ai/flux-1/schnell',
          },
        },
      ],
      forbiddenTools: ['update_node', 'delete_nodes'],
    },
  },
  {
    id: 'model-best-quality',
    category: 'Model Selection',
    name: 'Best quality image',
    userMessage: 'Generate a portrait photo of a woman in golden hour light. Use the highest quality image model you have.',
    canvasState: EMPTY_CANVAS,
    expectation: {
      expectedToolCalls: [
        { name: 'get_available_models' },
        {
          name: 'add_node',
          args: {
            contentType: 'image',
            model: isOneOf(['fal-ai/flux-pro/v1.1-ultra', 'fal-ai/imagen4/preview']),
          },
        },
      ],
      forbiddenTools: ['update_node', 'delete_nodes'],
    },
  },

  // ═══ Research & PDF ═══
  {
    id: 'research-quantum',
    category: 'Research & PDF',
    name: 'Deep research',
    userMessage: 'Research quantum computing',
    canvasState: EMPTY_CANVAS,
    expectation: {
      expectedToolCalls: [
        {
          name: 'deep_research',
          args: {
            topic: (v: unknown) => typeof v === 'string' && v.toLowerCase().includes('quantum'),
          },
        },
      ],
      forbiddenTools: ['web_search', 'create_pdf'],
    },
  },
  {
    id: 'research-pdf',
    category: 'Research & PDF',
    name: 'Research then PDF',
    userMessage: 'Create a PDF about AI safety',
    canvasState: EMPTY_CANVAS,
    expectation: {
      expectedToolCalls: [
        {
          name: 'deep_research',
          args: {
            topic: (v: unknown) => typeof v === 'string' && v.toLowerCase().includes('ai'),
          },
        },
        {
          name: 'create_pdf',
          args: {
            title: (v: unknown) => typeof v === 'string' && v.length > 0,
            markdown: (v: unknown) => typeof v === 'string' && v.length > 0,
          },
        },
      ],
      forbiddenTools: ['web_search'],
    },
  },

  // ═══ Instruction Following ═══
  {
    id: 'instruct-no-update-completed',
    category: 'Instruction Following',
    name: 'No update on completed',
    userMessage: 'I want to make the sunset more dramatic and vibrant',
    canvasState: {
      nodes: [
        {
          id: 'node-1',
          contentType: 'image',
          label: 'Sunset',
          prompt: 'a beautiful sunset',
          model: 'fal-ai/flux-pro/v1.1-ultra',
          generationStatus: 'completed',
          resultUrl: 'https://fal.media/files/example/sunset.jpg',
          x: 100,
          y: 100,
        },
      ],
      edges: [],
    },
    expectation: {
      expectedToolCalls: [
        { name: 'get_canvas_state' },
      ],
      forbiddenTools: ['update_node'],
      customValidator: (result) => {
        const hasUpdate = result.allToolCalls.some((tc) => tc.name === 'update_node')
        if (hasUpdate) return { score: 0, reason: 'Called update_node on completed node — RULE VIOLATION' }
        const hasAdd = result.allToolCalls.some((tc) => tc.name === 'add_node')
        const hasConnect = result.allToolCalls.some((tc) => tc.name === 'connect_nodes')
        if (hasAdd && hasConnect) return { score: 1, reason: 'Created new downstream node and connected it' }
        if (hasAdd) return { score: 0.8, reason: 'Created new node but did not connect to source' }
        const hasText = result.rounds.some((r) => r.assistantText.length > 20)
        if (hasText) return { score: 0.5, reason: 'Only explained constraint, did not create downstream node' }
        return { score: 0.3, reason: 'Did not act or explain' }
      },
    },
  },
  {
    id: 'instruct-info-only',
    category: 'Instruction Following',
    name: 'Info query (no actions)',
    userMessage: 'What models do you support?',
    canvasState: EMPTY_CANVAS,
    expectation: {
      expectedToolCalls: [
        { name: 'get_available_models' },
      ],
      expectNoActions: true,
      forbiddenTools: ['add_node', 'connect_nodes', 'update_node', 'delete_nodes', 'clear_canvas'],
    },
  },
]
