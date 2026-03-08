import { describe, expect, it } from 'vitest'

import {
  formatTextDocument,
  getFormattedTextNodeUpdate,
} from '@/utils/textDocumentFormatting'

describe('formatTextDocument', () => {
  it('applies bold to matching inline text', () => {
    expect(
      formatTextDocument('<p>Hello world</p>', {
        format: 'bold',
        targetText: 'world',
      }),
    ).toBe('<p>Hello <strong>world</strong></p>')
  })

  it('turns a paragraph into an h2', () => {
    expect(
      formatTextDocument('<p>Roadmap</p>', {
        format: 'heading',
        targetText: 'Roadmap',
        level: 2,
      }),
    ).toBe('<h2>Roadmap</h2>')
  })

  it('turns a paragraph into a bullet list', () => {
    expect(
      formatTextDocument('<p>Ship weekly</p>', {
        format: 'bullet_list',
        targetText: 'Ship weekly',
      }),
    ).toBe('<ul><li>Ship weekly</li></ul>')
  })

  it('returns null when the target text is missing', () => {
    expect(
      formatTextDocument('<p>Hello world</p>', {
        format: 'italic',
        targetText: 'missing',
      }),
    ).toBeNull()
  })
})

describe('getFormattedTextNodeUpdate', () => {
  it('returns a text-node document patch', () => {
    expect(
      getFormattedTextNodeUpdate('<p>Hello world</p>', {
        format: 'bold',
        targetText: 'world',
      }),
    ).toEqual({
      generationStatus: 'completed',
      generationId: undefined,
      resultText: '<p>Hello <strong>world</strong></p>',
      errorMessage: undefined,
    })
  })
})
