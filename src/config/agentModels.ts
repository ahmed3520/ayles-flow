export type AgentModelOption = {
  id: string
  name: string
}

export const AGENT_MODELS: Array<AgentModelOption> = [
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
  { id: 'openai/gpt-5.2', name: 'GPT-5.2' },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { id: 'minimax/minimax-m2.1', name: 'MiniMax M2.1' },
  { id: 'minimax/minimax-m2-her', name: 'MiniMax M2 Her' },
  { id: 'z-ai/glm-4.7', name: 'GLM 4.7' },
  { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5' },
]

export const DEFAULT_AGENT_MODEL = 'anthropic/claude-sonnet-4.5'
