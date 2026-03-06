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

export type FalImageToolAction = 'remove_background' | 'upscale'

type RunFalImageToolInput = {
  action: FalImageToolAction
  imageUrl: string
  upscaleFactor?: number
}

type RunFalImageToolResult = {
  requestId: string
  model: string
  imageUrl: string
  width?: number
  height?: number
}

const FAL_IMAGE_TOOL_MODELS: Record<FalImageToolAction, string> = {
  remove_background: 'fal-ai/bria/background/remove',
  upscale: 'fal-ai/topaz/upscale/image',
}

const FAL_QUEUE_BASE_URL = 'https://queue.fal.run'
const FAL_QUEUE_TIMEOUT_MS = 120000
const FAL_QUEUE_POLL_INTERVAL_MS = 1200

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

type FalImagePayload = {
  url: string
  width?: number
  height?: number
}

function extractImageFromFalResponse(
  payload: Record<string, unknown>,
): FalImagePayload {
  const image = payload.image as
    | { url?: string; width?: number; height?: number }
    | string
    | undefined
  if (typeof image === 'string') {
    return { url: image }
  }
  if (image?.url) {
    return { url: image.url, width: image.width, height: image.height }
  }

  const images = payload.images as
    | Array<{ url?: string; width?: number; height?: number } | string>
    | undefined
  const first = images?.[0]
  if (typeof first === 'string') {
    return { url: first }
  }
  if (first?.url) {
    return { url: first.url, width: first.width, height: first.height }
  }

  throw new Error('No image URL in fal.ai response')
}

async function submitFalQueueRequest(
  model: string,
  input: Record<string, unknown>,
  falKey: string,
): Promise<string> {
  const response = await fetch(`${FAL_QUEUE_BASE_URL}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`fal.ai submit failed (${response.status}): ${errorBody}`)
  }

  const result = (await response.json()) as { request_id?: string }
  if (!result.request_id) {
    throw new Error('fal.ai submit returned no request_id')
  }
  return result.request_id
}

async function waitForFalQueueResult(
  model: string,
  requestId: string,
  falKey: string,
): Promise<Record<string, unknown>> {
  const headers = {
    Authorization: `Key ${falKey}`,
    'Content-Type': 'application/json',
  }

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms)
    })

  const startTime = Date.now()
  while (Date.now() - startTime < FAL_QUEUE_TIMEOUT_MS) {
    const statusResponse = await fetch(
      `${FAL_QUEUE_BASE_URL}/${model}/requests/${requestId}/status`,
      { headers },
    )

    if (!statusResponse.ok) {
      const errorBody = await statusResponse.text()
      throw new Error(
        `fal.ai status check failed (${statusResponse.status}): ${errorBody}`,
      )
    }

    const statusBody = (await statusResponse.json()) as {
      status?: string
      error?: string
    }
    const status = (statusBody.status || '').toUpperCase()

    if (status === 'COMPLETED') break
    if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELED') {
      throw new Error(statusBody.error || `fal.ai job ${status.toLowerCase()}`)
    }

    await sleep(FAL_QUEUE_POLL_INTERVAL_MS)
  }

  if (Date.now() - startTime >= FAL_QUEUE_TIMEOUT_MS) {
    throw new Error('fal.ai request timed out')
  }

  const resultResponse = await fetch(
    `${FAL_QUEUE_BASE_URL}/${model}/requests/${requestId}`,
    { headers },
  )
  if (!resultResponse.ok) {
    const errorBody = await resultResponse.text()
    throw new Error(
      `fal.ai result fetch failed (${resultResponse.status}): ${errorBody}`,
    )
  }

  const resultBody = (await resultResponse.json()) as {
    response?: Record<string, unknown>
    data?: Record<string, unknown>
  } & Record<string, unknown>

  return resultBody.response || resultBody.data || resultBody
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

export const runFalImageTool = createServerFn({
  method: 'POST',
})
  .inputValidator((data: RunFalImageToolInput) => data)
  .handler(async ({ data }): Promise<RunFalImageToolResult> => {
    const falKey = process.env.FAL_KEY
    if (!falKey) {
      throw new Error('FAL_KEY environment variable is not configured')
    }

    const imageUrl = data.imageUrl.trim()
    if (!imageUrl) {
      throw new Error('Image URL is required')
    }

    const model = FAL_IMAGE_TOOL_MODELS[data.action]
    const input: Record<string, unknown> = { image_url: imageUrl }

    if (data.action === 'upscale') {
      const factor = Math.max(2, Math.min(4, Math.round(data.upscaleFactor ?? 2)))
      input.upscale_factor = factor
      input.model = 'Standard V2'
    }

    const requestId = await submitFalQueueRequest(model, input, falKey)
    const payload = await waitForFalQueueResult(model, requestId, falKey)
    const image = extractImageFromFalResponse(payload)

    return {
      requestId,
      model,
      imageUrl: image.url,
      width: image.width,
      height: image.height,
    }
  })
