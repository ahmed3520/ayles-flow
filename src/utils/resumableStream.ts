type JsonRecord = Record<string, unknown>

export type StreamStatus = {
  exists: boolean
  done?: boolean
  eventCount?: number
  connected?: boolean
  nextSeq?: number
}

type SocketRef = {
  current: WebSocket | null
}

type ResumableStreamRunOptions<TEvent extends { type: string }> = {
  wsUrl: string
  initialPayload?: JsonRecord
  resume?: {
    streamId: string
    afterSeq: number
  }
  controller: AbortController
  socketRef?: SocketRef
  onEvent: (event: TEvent) => void
  onStreamReady?: (meta: {
    streamId: string
    nextSeq?: number
    afterSeq: number
  }) => void
  onSequence?: (meta: {
    streamId: string | null
    seq: number
  }) => void
  onReconnect?: (attempt: number, maxRetries: number) => void
  isFatalEvent?: (event: TEvent) => boolean
  maxRetries?: number
  pingTimeoutMs?: number
}

export async function fetchStreamStatus(url: string): Promise<StreamStatus> {
  const response = await fetch(url)
  return response.json() as Promise<StreamStatus>
}

export async function cancelStream(
  url: string,
  streamId: string,
): Promise<void> {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ streamId }),
  })
}

export async function runResumableStream<TEvent extends { type: string }>({
  wsUrl,
  initialPayload,
  resume,
  controller,
  socketRef,
  onEvent,
  onStreamReady,
  onSequence,
  onReconnect,
  isFatalEvent,
  maxRetries = 5,
  pingTimeoutMs = 45_000,
}: ResumableStreamRunOptions<TEvent>): Promise<{
  streamId: string | null
  afterSeq: number
}> {
  let streamId = resume?.streamId ?? null
  let afterSeq = resume?.afterSeq ?? 0

  const connect = (attempt: number): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      let settled = false
      let sawDone = false
      let receivedFatalError = false
      let pingTimer: ReturnType<typeof setTimeout> | null = null

      const socket = new WebSocket(wsUrl)
      if (socketRef) socketRef.current = socket

      const cleanup = () => {
        if (pingTimer) clearTimeout(pingTimer)
        controller.signal.removeEventListener('abort', abortSocket)
        if (socketRef?.current === socket) {
          socketRef.current = null
        }
      }

      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        cleanup()
        fn()
      }

      const resetPingTimer = () => {
        if (pingTimer) clearTimeout(pingTimer)
        pingTimer = setTimeout(() => {
          if (!settled && socket.readyState === WebSocket.OPEN) {
            try { socket.close(4000, 'ping timeout') } catch { /* ignore */ }
          }
        }, pingTimeoutMs)
      }

      const abortSocket = () => {
        try { socket.close(1000, 'aborted') } catch { /* ignore */ }
      }

      controller.signal.addEventListener('abort', abortSocket)

      socket.onopen = () => {
        if (controller.signal.aborted) {
          try { socket.close(1000, 'aborted-before-open') } catch { /* ignore */ }
          return
        }
        resetPingTimer()
        if (streamId && (resume || attempt > 0)) {
          socket.send(
            JSON.stringify({
              resume: streamId,
              afterSeq,
              lastIndex: afterSeq,
            }),
          )
          return
        }

        if (!initialPayload) {
          finish(() => reject(new Error('Missing initial stream payload')))
          return
        }

        socket.send(JSON.stringify(initialPayload))
      }

      socket.onmessage = (message) => {
        if (controller.signal.aborted) return
        if (typeof message.data !== 'string') return
        resetPingTimer()

        let parsed: JsonRecord
        try {
          parsed = JSON.parse(message.data) as JsonRecord
        } catch {
          return
        }

        if (parsed.type === 'ping') return

        if (parsed.type === 'stream_id') {
          streamId = parsed.streamId as string
          onStreamReady?.({
            streamId,
            nextSeq: typeof parsed.nextSeq === 'number' ? parsed.nextSeq : undefined,
            afterSeq,
          })
          return
        }

        const seq = typeof parsed.seq === 'number'
          ? parsed.seq
          : afterSeq + 1
        afterSeq = seq
        onSequence?.({ streamId, seq })

        const event = parsed as TEvent
        if (isFatalEvent?.(event)) {
          receivedFatalError = true
        }
        if (event.type === 'done') {
          sawDone = true
        }
        onEvent(event)
        if (event.type === 'done') {
          try { socket.close(1000, 'done') } catch { /* ignore */ }
        }
      }

      socket.onerror = () => {
        // Let onclose handle retry logic.
      }

      socket.onclose = (event) => {
        if (controller.signal.aborted) {
          finish(() => reject(new DOMException('Aborted', 'AbortError')))
          return
        }
        if (event.code === 4001) {
          finish(() => reject(new DOMException('Superseded', 'AbortError')))
          return
        }
        if (sawDone) {
          finish(resolve)
          return
        }
        if (receivedFatalError) {
          finish(() => reject(new Error('Server error')))
          return
        }

        const canResume = streamId || attempt === 0
        if (canResume && attempt < maxRetries) {
          onReconnect?.(attempt + 1, maxRetries)
          window.setTimeout(() => {
            if (controller.signal.aborted) {
              finish(() => reject(new DOMException('Aborted', 'AbortError')))
              return
            }
            connect(attempt + 1).then(
              () => finish(resolve),
              (error) => finish(() => reject(error)),
            )
          }, 1000 * Math.pow(2, Math.min(attempt, 3)))
          return
        }

        finish(() =>
          reject(
            new Error(
              `WebSocket closed (${event.code})${event.reason ? `: ${event.reason}` : ''}`,
            ),
          ),
        )
      }
    })

  await connect(0)
  return { streamId, afterSeq }
}
