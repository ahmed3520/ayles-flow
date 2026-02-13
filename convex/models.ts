import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('models')
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()
  },
})

export const listByContentType = query({
  args: { contentType: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('models')
      .withIndex('by_contentType', (q) => q.eq('contentType', args.contentType))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()
  },
})

export const listCompatible = query({
  args: {
    contentType: v.string(),
    connectedInputTypes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const models = await ctx.db
      .query('models')
      .withIndex('by_contentType', (q) => q.eq('contentType', args.contentType))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect()

    if (!args.connectedInputTypes || args.connectedInputTypes.length === 0) {
      return models
    }

    const mediaTypes = args.connectedInputTypes.filter((t) => t !== 'text')
    if (mediaTypes.length === 0) return models

    return models.filter((model) => {
      const modelInputTypes = model.inputs.map((i: { type: string }) => i.type)
      return mediaTypes.every((t) => modelInputTypes.includes(t))
    })
  },
})

const PROMPT_INPUT = {
  name: 'Prompt',
  type: 'text',
  required: true,
  falParam: 'prompt',
}
const TEXT_INPUT = {
  name: 'Text',
  type: 'text',
  required: true,
  falParam: 'text',
}
const IMAGE_INPUT_OPTIONAL = {
  name: 'Image',
  type: 'image',
  required: false,
  falParam: 'image_url',
}
const IMAGE_INPUT_REQUIRED = {
  name: 'Image',
  type: 'image',
  required: true,
  falParam: 'image_url',
}

const SEED_MODELS = [
  // ── Image models (text-to-image only) ──
  {
    falId: 'fal-ai/imagen4/preview',
    name: 'Imagen 4',
    provider: 'Google',
    contentType: 'image',
    creditCost: 0.04,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT],
    outputType: 'image',
  },
  {
    falId: 'fal-ai/flux-pro/v1.1-ultra',
    name: 'FLUX 1.1 Pro Ultra',
    provider: 'Black Forest Labs',
    contentType: 'image',
    creditCost: 0.06,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT],
    outputType: 'image',
  },
  {
    falId: 'fal-ai/recraft/v3/text-to-image',
    name: 'Recraft V3',
    provider: 'Recraft',
    contentType: 'image',
    creditCost: 0.04,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT],
    outputType: 'image',
  },
  {
    falId: 'fal-ai/hidream-i1-full',
    name: 'HiDream I1 Full',
    provider: 'HiDream',
    contentType: 'image',
    creditCost: 0.03,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT],
    outputType: 'image',
  },
  {
    falId: 'fal-ai/gpt-image-1/text-to-image',
    name: 'GPT Image 1',
    provider: 'OpenAI',
    contentType: 'image',
    creditCost: 0.05,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT],
    outputType: 'image',
  },
  {
    falId: 'fal-ai/flux-1/schnell',
    name: 'FLUX.1 [schnell]',
    provider: 'Black Forest Labs',
    contentType: 'image',
    creditCost: 0.003,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT],
    outputType: 'image',
  },
  // ── Image models (text-to-image + image-to-image) ──
  {
    falId: 'fal-ai/flux-2',
    name: 'FLUX.2 [dev]',
    provider: 'Black Forest Labs',
    contentType: 'image',
    creditCost: 0.05,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT, IMAGE_INPUT_OPTIONAL],
    outputType: 'image',
  },
  {
    falId: 'fal-ai/ideogram/v3',
    name: 'Ideogram V3',
    provider: 'Ideogram',
    contentType: 'image',
    creditCost: 0.04,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT, IMAGE_INPUT_OPTIONAL],
    outputType: 'image',
  },
  {
    falId: 'fal-ai/flux/dev',
    name: 'FLUX.1 [dev]',
    provider: 'Black Forest Labs',
    contentType: 'image',
    creditCost: 0.025,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT],
    outputType: 'image',
  },
  {
    falId: 'fal-ai/flux-pro/kontext',
    name: 'FLUX.1 [kontext]',
    provider: 'Black Forest Labs',
    contentType: 'image',
    creditCost: 0.004,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT, IMAGE_INPUT_OPTIONAL],
    outputType: 'image',
  },
  {
    falId: 'fal-ai/stable-diffusion-v3-medium/image-to-image',
    name: 'SD 3.5 Medium',
    provider: 'Stability AI',
    contentType: 'image',
    creditCost: 0.035,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT, IMAGE_INPUT_OPTIONAL],
    outputType: 'image',
  },
  // ── Video models (text-to-video) ──
  {
    falId: 'fal-ai/kling-video/v2.1/master/text-to-video',
    name: 'Kling 2.1 Master',
    provider: 'Kling',
    contentType: 'video',
    creditCost: 0.1,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT],
    outputType: 'video',
  },
  {
    falId: 'fal-ai/minimax/video-01',
    name: 'MiniMax Video-01',
    provider: 'MiniMax',
    contentType: 'video',
    creditCost: 0.1,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT],
    outputType: 'video',
  },
  {
    falId: 'fal-ai/minimax/hailuo-02/pro/text-to-video',
    name: 'Hailuo-02 Pro',
    provider: 'MiniMax',
    contentType: 'video',
    creditCost: 0.1,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT],
    outputType: 'video',
  },
  // ── Video models (image-to-video) ──
  {
    falId: 'fal-ai/kling-video/v2.1/master/image-to-video',
    name: 'Kling 2.1 Master (I2V)',
    provider: 'Kling',
    contentType: 'video',
    creditCost: 0.1,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT, IMAGE_INPUT_REQUIRED],
    outputType: 'video',
  },
  {
    falId: 'fal-ai/minimax/video-01-live/image-to-video',
    name: 'MiniMax Video-01 (I2V)',
    provider: 'MiniMax',
    contentType: 'video',
    creditCost: 0.1,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT, IMAGE_INPUT_REQUIRED],
    outputType: 'video',
  },
  {
    falId: 'fal-ai/minimax/hailuo-02/pro/image-to-video',
    name: 'Hailuo-02 Pro (I2V)',
    provider: 'MiniMax',
    contentType: 'video',
    creditCost: 0.1,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT, IMAGE_INPUT_REQUIRED],
    outputType: 'video',
  },
  // ── Audio models (TTS) ──
  {
    falId: 'fal-ai/orpheus-tts',
    name: 'Orpheus TTS',
    provider: 'Orpheus',
    contentType: 'audio',
    creditCost: 0.05,
    pricingUnit: 'per 1k chars',
    inputs: [TEXT_INPUT],
    outputType: 'audio',
  },
  {
    falId: 'fal-ai/elevenlabs/tts/eleven-v3',
    name: 'ElevenLabs V3',
    provider: 'ElevenLabs',
    contentType: 'audio',
    creditCost: 0.05,
    pricingUnit: 'per 1k chars',
    inputs: [TEXT_INPUT],
    outputType: 'audio',
  },
  {
    falId: 'fal-ai/chatterbox/text-to-speech',
    name: 'Chatterbox',
    provider: 'Chatterbox',
    contentType: 'audio',
    creditCost: 0.05,
    pricingUnit: 'per 1k chars',
    inputs: [
      TEXT_INPUT,
      {
        name: 'Voice Clone Audio',
        type: 'audio',
        required: false,
        falParam: 'audio_url',
      },
    ],
    outputType: 'audio',
  },
  // ── Music models ──
  {
    falId: 'fal-ai/minimax-music',
    name: 'MiniMax Music',
    provider: 'MiniMax',
    contentType: 'music',
    creditCost: 0.035,
    pricingUnit: 'per generation',
    inputs: [
      PROMPT_INPUT,
      {
        name: 'Reference Audio',
        type: 'audio',
        required: false,
        falParam: 'reference_audio_url',
      },
    ],
    outputType: 'audio',
  },
  {
    falId: 'fal-ai/lyria2',
    name: 'Lyria 2',
    provider: 'Google',
    contentType: 'music',
    creditCost: 0.04,
    pricingUnit: 'per generation',
    inputs: [PROMPT_INPUT],
    outputType: 'audio',
  },
  {
    falId: 'cassetteai/music-generator',
    name: 'CassetteAI',
    provider: 'CassetteAI',
    contentType: 'music',
    creditCost: 0.02,
    pricingUnit: 'per minute',
    inputs: [PROMPT_INPUT],
    outputType: 'audio',
  },
]

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear all existing models
    const existing = await ctx.db.query('models').collect()
    for (const model of existing) {
      await ctx.db.delete(model._id)
    }

    // Insert fresh seed data
    for (const model of SEED_MODELS) {
      await ctx.db.insert('models', {
        ...model,
        isActive: true,
      })
    }
  },
})
