import { describe, expect, it } from 'vitest'

import { extractMediaUrl } from './http'

describe('extractMediaUrl', () => {
  // ── Image ────────────────────────────────────────────────────────────────

  it('extracts image URL and metadata', () => {
    const payload = {
      images: [{ url: 'https://cdn.fal.ai/img.png', width: 1024, height: 768 }],
    }
    const result = extractMediaUrl('image', 'fal-ai/flux-pro', payload)
    expect(result.url).toBe('https://cdn.fal.ai/img.png')
    expect(result.meta).toEqual({ width: 1024, height: 768 })
  })

  it('throws when image payload has no images', () => {
    expect(() => extractMediaUrl('image', 'fal-ai/flux-pro', {})).toThrow(
      'No image URL in payload',
    )
  })

  it('throws when first image has no URL', () => {
    expect(() =>
      extractMediaUrl('image', 'fal-ai/flux-pro', { images: [{}] }),
    ).toThrow('No image URL in payload')
  })

  // ── Video ────────────────────────────────────────────────────────────────

  it('extracts video URL', () => {
    const payload = { video: { url: 'https://cdn.fal.ai/vid.mp4' } }
    const result = extractMediaUrl('video', 'fal-ai/minimax-video', payload)
    expect(result.url).toBe('https://cdn.fal.ai/vid.mp4')
    expect(result.meta).toBeUndefined()
  })

  it('throws when video payload is missing', () => {
    expect(() => extractMediaUrl('video', 'fal-ai/minimax-video', {})).toThrow(
      'No video URL in payload',
    )
  })

  // ── Audio ────────────────────────────────────────────────────────────────

  it('extracts audio URL', () => {
    const payload = { audio: { url: 'https://cdn.fal.ai/audio.wav' } }
    const result = extractMediaUrl('audio', 'fal-ai/tts', payload)
    expect(result.url).toBe('https://cdn.fal.ai/audio.wav')
  })

  it('throws when audio payload is missing', () => {
    expect(() => extractMediaUrl('audio', 'fal-ai/tts', {})).toThrow(
      'No audio URL in payload',
    )
  })

  // ── Music (standard) ────────────────────────────────────────────────────

  it('extracts music audio URL for standard models', () => {
    const payload = { audio: { url: 'https://cdn.fal.ai/music.wav' } }
    const result = extractMediaUrl('music', 'fal-ai/minimax-music', payload)
    expect(result.url).toBe('https://cdn.fal.ai/music.wav')
  })

  // ── Music (CassetteAI) ──────────────────────────────────────────────────

  it('extracts audio_file URL for cassetteai model', () => {
    const payload = {
      audio_file: { url: 'https://cdn.fal.ai/cassette.wav' },
    }
    const result = extractMediaUrl(
      'music',
      'cassetteai/music-generator',
      payload,
    )
    expect(result.url).toBe('https://cdn.fal.ai/cassette.wav')
  })

  it('throws when cassetteai audio_file is missing', () => {
    expect(() =>
      extractMediaUrl('music', 'cassetteai/music-generator', {}),
    ).toThrow('No audio_file URL in payload')
  })

  it('throws when standard music audio is missing', () => {
    expect(() =>
      extractMediaUrl('music', 'fal-ai/minimax-music', {}),
    ).toThrow('No audio URL in payload')
  })

  // ── Unknown content type ─────────────────────────────────────────────────

  it('throws for unknown content type', () => {
    expect(() => extractMediaUrl('3d', 'some-model', {})).toThrow(
      'Unknown content type: 3d',
    )
  })
})
