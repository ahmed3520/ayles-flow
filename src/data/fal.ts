import { createServerFn } from '@tanstack/react-start'

type SubmitInput = {
  model: string
  prompt: string
  contentType: string
  imageUrl?: string
  audioUrl?: string
  videoUrl?: string
}

type SubmitResult = {
  requestId: string
}

// Model-specific overrides for audio param name
const AUDIO_PARAM_OVERRIDES: Partial<Record<string, string>> = {
  'fal-ai/minimax-music': 'reference_audio_url',
}

// Models that accept image_urls (array) instead of image_url (string)
const IMAGE_ARRAY_MODELS = new Set([
  'fal-ai/bytedance/seedream/v5/lite/edit',
])

export function buildFalInput(data: SubmitInput): Record<string, unknown> {
  const { contentType, model, prompt, imageUrl, audioUrl, videoUrl } = data
  const input: Record<string, unknown> = {}

  // Content-type defaults
  switch (contentType) {
    case 'image':
      input.image_size = IMAGE_ARRAY_MODELS.has(model) ? 'auto_2K' : 'landscape_4_3'
      input.num_images = 1
      break
    case 'video':
      input.duration = '5'
      input.aspect_ratio = '16:9'
      break
    case 'music':
      if (model === 'cassetteai/music-generator') {
        input.duration = 30
      }
      break
  }

  // Prompt/text mapping — audio TTS uses 'text', everything else uses 'prompt'
  if (contentType === 'audio') {
    input.text = prompt
  } else {
    input.prompt = prompt
  }

  // Media inputs — flat fields, no nested objects
  if (imageUrl) {
    if (IMAGE_ARRAY_MODELS.has(model)) {
      input.image_urls = [imageUrl]
    } else {
      input.image_url = imageUrl
    }
  }
  if (audioUrl) {
    input[AUDIO_PARAM_OVERRIDES[model] ?? 'audio_url'] = audioUrl
  }
  if (videoUrl) {
    input.video_url = videoUrl
  }

  return input
}

export const submitToFal = createServerFn({
  method: 'POST',
})
  .inputValidator((data: SubmitInput) => data)
  .handler(async ({ data }): Promise<SubmitResult> => {
    const falKey = process.env.FAL_KEY
    if (!falKey) {
      throw new Error('FAL_KEY environment variable is not configured')
    }

    const convexSiteUrl = process.env.CONVEX_SITE_URL
    if (!convexSiteUrl) {
      throw new Error(
        'CONVEX_SITE_URL environment variable is not configured',
      )
    }

    if (!data.prompt.trim()) {
      throw new Error('Prompt cannot be empty')
    }

    const input = buildFalInput(data)
    const webhookUrl = `${convexSiteUrl}/fal/webhook`

    const response = await fetch(
      `https://queue.fal.run/${data.model}?fal_webhook=${encodeURIComponent(webhookUrl)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `fal.ai submission failed (${response.status}): ${errorBody}`,
      )
    }

    const result = (await response.json()) as { request_id: string }

    return { requestId: result.request_id }
  })
