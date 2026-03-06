import { describe, expect, it, vi } from 'vitest'

import { createAgentStreamAccumulator } from '@/utils/agentStreamAccumulator'

describe('createAgentStreamAccumulator', () => {
  it('builds assistant content, parts, and actions while delegating side effects', () => {
    const updateAssistant = vi.fn()
    const setToolStatus = vi.fn()
    const applyAction = vi.fn()
    const createPdfFromAction = vi.fn()

    const accumulator = createAgentStreamAccumulator({
      updateAssistant,
      setToolStatus,
      applyAction,
      createPdfFromAction,
    })

    accumulator.handleEvent({ type: 'text_delta', content: 'Hello' })
    accumulator.handleEvent({ type: 'reasoning', content: 'Thinking' })
    accumulator.handleEvent({
      type: 'tool_start',
      tool: 'search',
      args: { q: 'cats' },
    })
    accumulator.handleEvent({
      type: 'tool_call',
      tool: 'search',
      args: { q: 'cats' },
    })
    accumulator.handleEvent({
      type: 'action',
      action: {
        type: 'add_node',
        nodeId: 'node-1',
        contentType: 'image',
        x: 10,
        y: 20,
      },
    })
    accumulator.handleEvent({
      type: 'action',
      action: {
        type: 'create_pdf',
        title: 'Report',
        markdown: '# Report',
        sources: [],
        x: 30,
        y: 40,
      },
    })
    accumulator.handleEvent({
      type: 'error',
      message: 'Something broke',
    })

    const snapshot = accumulator.snapshot()

    expect(snapshot.content).toContain('Hello')
    expect(snapshot.content).toContain('Error: Something broke')
    expect(snapshot.parts).toHaveLength(6)
    expect(snapshot.actions).toHaveLength(2)
    expect(applyAction).toHaveBeenCalledTimes(1)
    expect(createPdfFromAction).toHaveBeenCalledTimes(1)
    expect(setToolStatus).toHaveBeenCalledWith(null)
    expect(updateAssistant).toHaveBeenCalled()
  })
})
