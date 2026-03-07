import { httpRouter } from 'convex/server'

import { internal } from './_generated/api'
import { httpAction } from './_generated/server'

const http = httpRouter()

export function extractMediaUrl(
  contentType: string,
  modelId: string,
  payload: Record<string, unknown>,
): { url: string; meta?: Record<string, unknown> } {
  if (contentType === 'image' || contentType === 'remove_background' || contentType === 'upscale') {
    // These models return {image: {url, ...}} or {images: [{url, ...}]}
    const singleImage = payload.image as
      | { url: string; width?: number; height?: number }
      | undefined
    if (singleImage?.url) {
      return {
        url: singleImage.url,
        meta: { width: singleImage.width, height: singleImage.height },
      }
    }
    const images = payload.images as
      | Array<{
          url: string
          width?: number
          height?: number
        }>
      | undefined
    const image = images?.[0]
    if (!image?.url) throw new Error('No image URL in payload')
    return {
      url: image.url,
      meta: { width: image.width, height: image.height },
    }
  }

  if (contentType === 'video') {
    const video = payload.video as { url: string } | undefined
    if (!video?.url) throw new Error('No video URL in payload')
    return { url: video.url }
  }

  if (contentType === 'audio') {
    const audio = payload.audio as { url: string } | undefined
    if (!audio?.url) throw new Error('No audio URL in payload')
    return { url: audio.url }
  }

  if (contentType === 'music') {
    // CassetteAI uses audio_file, others use audio
    if (modelId === 'cassetteai/music-generator') {
      const audioFile = payload.audio_file as { url: string } | undefined
      if (!audioFile?.url) throw new Error('No audio_file URL in payload')
      return { url: audioFile.url }
    }
    const audio = payload.audio as { url: string } | undefined
    if (!audio?.url) throw new Error('No audio URL in payload')
    return { url: audio.url }
  }

  throw new Error(`Unknown content type: ${contentType}`)
}

http.route({
  path: '/fal/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as {
      request_id: string
      gateway_request_id?: string
      status: string
      error?: string
      payload?: Record<string, unknown> | null
    }

    const falRequestId = body.request_id

    if (body.status === 'OK' && body.payload) {
      // Look up the generation to get contentType and modelId
      const generation = await ctx.runQuery(
        internal.generations.getByFalRequestId,
        { falRequestId },
      )

      if (!generation) {
        console.error(`No generation found for falRequestId: ${falRequestId}`)
        return new Response('Not found', { status: 404 })
      }

      try {
        const { url, meta } = extractMediaUrl(
          generation.contentType,
          generation.modelId,
          body.payload,
        )

        await ctx.runMutation(internal.generations.completeGeneration, {
          falRequestId,
          resultUrl: url,
          resultMeta: meta,
        })
      } catch (err) {
        await ctx.runMutation(internal.generations.failGeneration, {
          falRequestId,
          errorMessage:
            err instanceof Error ? err.message : 'Failed to parse result',
        })
      }
    } else {
      await ctx.runMutation(internal.generations.failGeneration, {
        falRequestId,
        errorMessage: body.error || 'Generation failed',
      })
    }

    return new Response('OK', { status: 200 })
  }),
})

http.route({
  path: '/polar/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const webhookId = request.headers.get('webhook-id')
    const webhookTimestamp = request.headers.get('webhook-timestamp')
    const webhookSignature = request.headers.get('webhook-signature')

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      return new Response('Missing webhook headers', { status: 400 })
    }

    const payload = await request.text()

    try {
      await ctx.runAction(internal.billing.handleWebhookEvent, {
        payload,
        webhookId,
        webhookTimestamp,
        webhookSignature,
      })
      return new Response('OK', { status: 200 })
    } catch (err) {
      console.error('Polar webhook error:', err)
      return new Response('Webhook processing failed', { status: 400 })
    }
  }),
})

export default http
