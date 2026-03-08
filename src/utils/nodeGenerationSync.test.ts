import { describe, expect, it } from 'vitest'

import type { BlockNodeData } from '@/types/nodes'
import { getGenerationSyncUpdate } from '@/utils/nodeGenerationSync'
import { getTextNodeDocumentUpdate } from '@/utils/nodeTextUtils'

function makeData(
  overrides: Partial<BlockNodeData> = {},
): BlockNodeData {
  return {
    contentType: 'text',
    label: 'Text block',
    prompt: '',
    model: 'model-1',
    generationStatus: 'idle',
    ...overrides,
  }
}

describe('getGenerationSyncUpdate', () => {
  it('applies a completed generation result and clears the generation link', () => {
    expect(
      getGenerationSyncUpdate(
        makeData({
          generationId: 'gen-1',
          generationStatus: 'generating',
        }),
        {
          status: 'completed',
          resultText: '<p>Fresh result</p>',
        },
      ),
    ).toEqual({
      generationStatus: 'completed',
      generationId: undefined,
      resultText: '<p>Fresh result</p>',
      resultUrl: undefined,
      imageWidth: undefined,
      imageHeight: undefined,
      errorMessage: undefined,
    })
  })

  it('keeps a manual edit and only clears the stale generation link', () => {
    expect(
      getGenerationSyncUpdate(
        makeData({
          generationId: 'gen-1',
          generationStatus: 'completed',
          resultText: '<p>Edited by user</p>',
        }),
        {
          status: 'completed',
          resultText: '<p>Original generated text</p>',
        },
      ),
    ).toEqual({
      generationId: undefined,
    })
  })

  it('surfaces generation errors and clears the generation link', () => {
    expect(
      getGenerationSyncUpdate(
        makeData({
          generationId: 'gen-1',
          generationStatus: 'generating',
        }),
        {
          status: 'error',
          errorMessage: 'Generation failed upstream',
        },
      ),
    ).toEqual({
      generationStatus: 'error',
      generationId: undefined,
      errorMessage: 'Generation failed upstream',
    })
  })
})

describe('getTextNodeDocumentUpdate', () => {
  it('clears generationId when a text document is edited', () => {
    expect(getTextNodeDocumentUpdate('<p>Edited document</p>')).toEqual({
      generationStatus: 'completed',
      generationId: undefined,
      resultText: '<p>Edited document</p>',
      errorMessage: undefined,
    })
  })
})
