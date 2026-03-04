export type AgentModelOption = {
  id: string
  name: string
  comingSoon?: boolean
}

export const AGENT_MODELS: Array<AgentModelOption> = [
  { id: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6' },
  { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6' },
  { id: 'minimax/minimax-m2.1', name: 'MiniMax M2.1' },
  { id: 'z-ai/glm-5', name: 'GLM 5' },
  { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5' },
  { id: 'ayles/quasar-v1', name: 'Quasar v1', comingSoon: true },
]

export const DEFAULT_AGENT_MODEL = 'anthropic/claude-sonnet-4.6'
