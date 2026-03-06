import type {
  AgentAction,
  ChatMessage,
  CreatePdfAction,
  MessagePart,
  StreamEvent,
} from '@/types/agent'

type AgentStreamAccumulatorOptions = {
  updateAssistant: (updates: Partial<ChatMessage>) => void
  setToolStatus: (status: string | null) => void
  applyAction: (action: AgentAction) => void
  createPdfFromAction: (action: CreatePdfAction) => void
}

export function createAgentStreamAccumulator({
  updateAssistant,
  setToolStatus,
  applyAction,
  createPdfFromAction,
}: AgentStreamAccumulatorOptions) {
  let content = ''
  const actions: Array<AgentAction> = []
  const parts: Array<MessagePart> = []

  const snapshot = () => ({
    content,
    actions: [...actions],
    parts: [...parts],
  })

  const handleEvent = (event: StreamEvent) => {
    switch (event.type) {
      case 'text_delta': {
        setToolStatus(null)
        content += event.content
        const lastPart = parts.at(-1)
        if (lastPart?.type === 'text') {
          lastPart.content += event.content
        } else {
          parts.push({ type: 'text', content: event.content })
        }
        updateAssistant({
          content,
          parts: [...parts],
        })
        return
      }

      case 'reasoning': {
        const lastPart = parts.at(-1)
        if (lastPart?.type === 'reasoning') {
          lastPart.content += event.content
        } else {
          parts.push({ type: 'reasoning', content: event.content })
        }
        updateAssistant({ parts: [...parts] })
        return
      }

      case 'tool_status':
        setToolStatus(event.status)
        return

      case 'tool_start':
        parts.push({
          type: 'tool_call',
          tool: event.tool,
          args: event.args,
          status: 'pending',
        })
        updateAssistant({ parts: [...parts] })
        return

      case 'tool_call': {
        setToolStatus(null)
        let matched = false

        for (let index = parts.length - 1; index >= 0; index--) {
          const part = parts[index]
          if (
            part.type === 'tool_call'
            && part.status === 'pending'
            && part.tool === event.tool
          ) {
            parts[index] = {
              ...part,
              args: event.args,
              status: 'done',
              error: event.error,
            }
            matched = true
            break
          }
        }

        if (!matched) {
          for (let index = parts.length - 1; index >= 0; index--) {
            const part = parts[index]
            if (part.type === 'tool_call' && part.status === 'pending') {
              parts[index] = {
                ...part,
                args: event.args,
                status: 'done',
                error: event.error,
              }
              matched = true
              break
            }
          }
        }

        if (!matched) {
          parts.push({
            type: 'tool_call',
            tool: event.tool,
            args: event.args,
            status: 'done',
            error: event.error,
          })
        }

        updateAssistant({ parts: [...parts] })
        return
      }

      case 'action': {
        setToolStatus(null)
        if (event.action.type === 'create_pdf') {
          createPdfFromAction(event.action)
          const slimAction = {
            ...event.action,
            markdown: '[content]',
          } as AgentAction
          actions.push(slimAction)
          parts.push({ type: 'action', action: slimAction })
        } else {
          applyAction(event.action)
          actions.push(event.action)
          parts.push({ type: 'action', action: event.action })
        }
        updateAssistant({
          actions: [...actions],
          parts: [...parts],
        })
        return
      }

      case 'resources':
        setToolStatus(null)
        parts.push({ type: 'resources', sources: event.sources })
        updateAssistant({ parts: [...parts] })
        return

      case 'error': {
        const errorContent = `\n\nError: ${event.message}`
        content += errorContent
        const lastPart = parts.at(-1)
        if (lastPart?.type === 'text') {
          lastPart.content += errorContent
        } else {
          parts.push({ type: 'text', content: errorContent })
        }
        updateAssistant({
          content,
          parts: [...parts],
        })
        return
      }

      case 'done':
        setToolStatus(null)
        return
    }
  }

  return {
    handleEvent,
    snapshot,
  }
}
