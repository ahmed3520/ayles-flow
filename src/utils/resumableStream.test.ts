import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cancelStream,
  fetchStreamStatus,
  runResumableStream,
} from '@/utils/resumableStream'

class FakeWebSocket {
  static instances: Array<FakeWebSocket> = []

  readonly url: string
  readyState = 0
  sent: Array<string> = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close(code = 1000, reason = '') {
    this.readyState = 3
    this.onclose?.({ code, reason })
  }

  open() {
    this.readyState = 1
    this.onopen?.()
  }

  receive(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }

  fail(code = 1006, reason = 'network') {
    this.readyState = 3
    this.onclose?.({ code, reason })
  }

  static reset() {
    FakeWebSocket.instances = []
  }
}

describe('resumableStream', () => {
  const originalWebSocket = globalThis.WebSocket
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    FakeWebSocket.reset()
    vi.useFakeTimers()
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.WebSocket = originalWebSocket
    globalThis.fetch = originalFetch
  })

  it('starts a new stream and tracks server sequence numbers', async () => {
    const onEvent = vi.fn()
    const onStreamReady = vi.fn()
    const onSequence = vi.fn()

    const promise = runResumableStream({
      wsUrl: 'ws://localhost:9400/v1/agent/ws',
      initialPayload: { hello: 'world' },
      controller: new AbortController(),
      onEvent,
      onStreamReady,
      onSequence,
    })

    const socket = FakeWebSocket.instances[0]
    socket.open()
    expect(socket.sent).toEqual([JSON.stringify({ hello: 'world' })])

    socket.receive({ type: 'stream_id', streamId: 'stream-1', nextSeq: 1 })
    socket.receive({ type: 'text_delta', content: 'Hi', seq: 1 })
    socket.receive({ type: 'done', seq: 2 })

    await expect(promise).resolves.toEqual({
      streamId: 'stream-1',
      afterSeq: 2,
    })
    expect(onStreamReady).toHaveBeenCalledWith({
      streamId: 'stream-1',
      nextSeq: 1,
      afterSeq: 0,
    })
    expect(onSequence).toHaveBeenCalledWith({
      streamId: 'stream-1',
      seq: 1,
    })
    expect(onEvent).toHaveBeenCalledTimes(2)
  })

  it('reconnects by resuming from the last acknowledged sequence', async () => {
    const onReconnect = vi.fn()

    const promise = runResumableStream({
      wsUrl: 'ws://localhost:9400/v1/agent/ws',
      initialPayload: { task: 'build' },
      controller: new AbortController(),
      onEvent: vi.fn(),
      onReconnect,
    })

    const firstSocket = FakeWebSocket.instances[0]
    firstSocket.open()
    firstSocket.receive({ type: 'stream_id', streamId: 'stream-2', nextSeq: 1 })
    firstSocket.receive({ type: 'text_delta', content: 'A', seq: 1 })
    firstSocket.fail()

    await vi.runAllTimersAsync()

    const secondSocket = FakeWebSocket.instances[1]
    secondSocket.open()
    expect(secondSocket.sent).toEqual([
      JSON.stringify({
        resume: 'stream-2',
        afterSeq: 1,
        lastIndex: 1,
      }),
    ])

    secondSocket.receive({ type: 'done', seq: 2 })

    await expect(promise).resolves.toEqual({
      streamId: 'stream-2',
      afterSeq: 2,
    })
    expect(onReconnect).toHaveBeenCalledWith(1, 5)
  })

  it('wraps status and cancel HTTP helpers', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({ exists: true, done: false, nextSeq: 3 }),
      })
      .mockResolvedValueOnce({ ok: true })

    globalThis.fetch = fetchMock as typeof fetch

    await expect(fetchStreamStatus('/status')).resolves.toEqual({
      exists: true,
      done: false,
      nextSeq: 3,
    })
    await cancelStream('/cancel', 'stream-3')

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/status')
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamId: 'stream-3' }),
    })
  })
})
