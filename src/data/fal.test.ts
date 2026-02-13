import { describe, expect, it } from 'vitest'

import { buildFalInput } from '@/data/fal'

describe('buildFalInput', () => {
  // ── Image ────────────────────────────────────────────────────────────────

  it('sets image defaults and prompt field', () => {
    const result = buildFalInput({
      model: 'fal-ai/flux-pro',
      prompt: 'a sunset',
      contentType: 'image',
    })
    expect(result).toEqual({
      image_size: 'landscape_4_3',
      num_images: 1,
      prompt: 'a sunset',
    })
  })

  // ── Video ────────────────────────────────────────────────────────────────

  it('sets video defaults and prompt field', () => {
    const result = buildFalInput({
      model: 'fal-ai/minimax-video',
      prompt: 'a running dog',
      contentType: 'video',
    })
    expect(result).toEqual({
      duration: '5',
      aspect_ratio: '16:9',
      prompt: 'a running dog',
    })
  })

  // ── Audio ────────────────────────────────────────────────────────────────

  it('uses text field instead of prompt for audio', () => {
    const result = buildFalInput({
      model: 'fal-ai/tts',
      prompt: 'Hello world',
      contentType: 'audio',
    })
    expect(result.text).toBe('Hello world')
    expect(result.prompt).toBeUndefined()
  })

  // ── Music ────────────────────────────────────────────────────────────────

  it('sets cassetteai music duration', () => {
    const result = buildFalInput({
      model: 'cassetteai/music-generator',
      prompt: 'jazz piano',
      contentType: 'music',
    })
    expect(result.duration).toBe(30)
    expect(result.prompt).toBe('jazz piano')
  })

  it('does not set duration for non-cassetteai music models', () => {
    const result = buildFalInput({
      model: 'fal-ai/minimax-music',
      prompt: 'rock song',
      contentType: 'music',
    })
    expect(result.duration).toBeUndefined()
    expect(result.prompt).toBe('rock song')
  })

  // ── Media URL injection ──────────────────────────────────────────────────

  it('injects imageUrl', () => {
    const result = buildFalInput({
      model: 'fal-ai/flux-pro',
      prompt: 'enhance',
      contentType: 'image',
      imageUrl: 'https://example.com/img.png',
    })
    expect(result.image_url).toBe('https://example.com/img.png')
  })

  it('injects audioUrl with default param name', () => {
    const result = buildFalInput({
      model: 'fal-ai/some-model',
      prompt: 'remix',
      contentType: 'music',
      audioUrl: 'https://example.com/audio.wav',
    })
    expect(result.audio_url).toBe('https://example.com/audio.wav')
  })

  it('uses reference_audio_url for minimax-music', () => {
    const result = buildFalInput({
      model: 'fal-ai/minimax-music',
      prompt: 'remix',
      contentType: 'music',
      audioUrl: 'https://example.com/audio.wav',
    })
    expect(result.reference_audio_url).toBe('https://example.com/audio.wav')
    expect(result.audio_url).toBeUndefined()
  })

  it('injects videoUrl', () => {
    const result = buildFalInput({
      model: 'fal-ai/video-model',
      prompt: 'extend',
      contentType: 'video',
      videoUrl: 'https://example.com/vid.mp4',
    })
    expect(result.video_url).toBe('https://example.com/vid.mp4')
  })

  // ── No media URLs when not provided ──────────────────────────────────────

  it('omits media fields when not provided', () => {
    const result = buildFalInput({
      model: 'fal-ai/flux-pro',
      prompt: 'test',
      contentType: 'image',
    })
    expect(result.image_url).toBeUndefined()
    expect(result.audio_url).toBeUndefined()
    expect(result.video_url).toBeUndefined()
  })
})
