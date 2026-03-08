import { describe, expect, it } from 'vitest'

import { buildFalInput } from '@/data/fal'

describe('buildFalInput', () => {
  // ── Image ────────────────────────────────────────────────────────────────

  it('sets image defaults and prompt field', () => {
    const { input } = buildFalInput({
      model: 'fal-ai/flux-pro',
      prompt: 'a sunset',
      contentType: 'image',
    })
    expect(input).toEqual({
      image_size: 'landscape_4_3',
      num_images: 1,
      prompt: 'a sunset',
    })
  })

  // ── Video ────────────────────────────────────────────────────────────────

  it('sets video defaults and prompt field', () => {
    const { input } = buildFalInput({
      model: 'fal-ai/minimax-video',
      prompt: 'a running dog',
      contentType: 'video',
    })
    expect(input).toEqual({
      duration: '5',
      aspect_ratio: '16:9',
      prompt: 'a running dog',
    })
  })

  // ── Audio ────────────────────────────────────────────────────────────────

  it('uses text field instead of prompt for audio', () => {
    const { input } = buildFalInput({
      model: 'fal-ai/tts',
      prompt: 'Hello world',
      contentType: 'audio',
    })
    expect(input.text).toBe('Hello world')
    expect(input.prompt).toBeUndefined()
  })

  // ── Music ────────────────────────────────────────────────────────────────

  it('sets cassetteai music duration', () => {
    const { input } = buildFalInput({
      model: 'cassetteai/music-generator',
      prompt: 'jazz piano',
      contentType: 'music',
    })
    expect(input.duration).toBe(30)
    expect(input.prompt).toBe('jazz piano')
  })

  it('does not set duration for non-cassetteai music models', () => {
    const { input } = buildFalInput({
      model: 'fal-ai/minimax-music',
      prompt: 'rock song',
      contentType: 'music',
    })
    expect(input.duration).toBeUndefined()
    expect(input.prompt).toBe('rock song')
  })

  // ── Media URL injection ──────────────────────────────────────────────────

  it('injects imageUrl', () => {
    const { input } = buildFalInput({
      model: 'fal-ai/flux-pro',
      prompt: 'enhance',
      contentType: 'image',
      imageUrl: 'https://example.com/img.png',
    })
    expect(input.image_url).toBe('https://example.com/img.png')
  })

  it('injects audioUrl with default param name', () => {
    const { input } = buildFalInput({
      model: 'fal-ai/some-model',
      prompt: 'remix',
      contentType: 'music',
      audioUrl: 'https://example.com/audio.wav',
    })
    expect(input.audio_url).toBe('https://example.com/audio.wav')
  })

  it('uses reference_audio_url for minimax-music', () => {
    const { input } = buildFalInput({
      model: 'fal-ai/minimax-music',
      prompt: 'remix',
      contentType: 'music',
      audioUrl: 'https://example.com/audio.wav',
    })
    expect(input.reference_audio_url).toBe('https://example.com/audio.wav')
    expect(input.audio_url).toBeUndefined()
  })

  it('injects videoUrl', () => {
    const { input } = buildFalInput({
      model: 'fal-ai/video-model',
      prompt: 'extend',
      contentType: 'video',
      videoUrl: 'https://example.com/vid.mp4',
    })
    expect(input.video_url).toBe('https://example.com/vid.mp4')
  })

  // ── No media URLs when not provided ──────────────────────────────────────

  it('omits media fields when not provided', () => {
    const { input } = buildFalInput({
      model: 'fal-ai/flux-pro',
      prompt: 'test',
      contentType: 'image',
    })
    expect(input.image_url).toBeUndefined()
    expect(input.audio_url).toBeUndefined()
    expect(input.video_url).toBeUndefined()
  })

  // ── Nano Banana 2 routing ────────────────────────────────────────────────

  it('routes nano-banana-2 to edit endpoint when image provided', () => {
    const { input, model } = buildFalInput({
      model: 'fal-ai/nano-banana-2',
      prompt: 'make it blue',
      contentType: 'image',
      imageUrl: 'https://example.com/img.png',
    })
    expect(model).toBe('fal-ai/nano-banana-2/edit')
    expect(input.image_urls).toEqual(['https://example.com/img.png'])
    expect(input.image_url).toBeUndefined()
  })

  it('keeps nano-banana-2 base endpoint without image', () => {
    const { model } = buildFalInput({
      model: 'fal-ai/nano-banana-2',
      prompt: 'a cat',
      contentType: 'image',
    })
    expect(model).toBe('fal-ai/nano-banana-2')
  })
})
