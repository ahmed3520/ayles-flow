import { describe, expect, it } from 'vitest'

import { formatDuration } from '@/utils/metadataExtraction'

describe('formatDuration', () => {
  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formats seconds under a minute', () => {
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(30)).toBe('0:30')
    expect(formatDuration(59)).toBe('0:59')
  })

  it('formats exact minutes', () => {
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(120)).toBe('2:00')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(605)).toBe('10:05')
    expect(formatDuration(3661)).toBe('61:01')
  })
})
