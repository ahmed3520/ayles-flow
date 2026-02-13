import Groq from 'groq-sdk'

type GroqSearchResult = {
  title?: string
  url?: string
  content?: string
}

type GroqExecutedTool = {
  type?: string
  search_results?: {
    results?: Array<GroqSearchResult>
  }
}

type GroqCompoundMessage = {
  content: string | null
  executed_tools?: Array<GroqExecutedTool>
}

const getClient = () => {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not configured')
  }
  return new Groq({
    apiKey,
    defaultHeaders: {
      'Groq-Model-Version': 'latest',
    },
  })
}

export type GroqWebResult = {
  content: string
  sources: Array<{ title: string; url: string }>
}

export async function groqWeb(query: string): Promise<GroqWebResult> {
  const client = getClient()

  const response = await client.chat.completions.create({
    model: 'groq/compound-mini',
    messages: [{ role: 'user', content: query }],
  })

  // Groq compound models return executed_tools on the message,
  // which isn't in the base SDK types
  const message = response.choices[0]?.message as unknown as GroqCompoundMessage
  const content = message.content ?? ''

  const sources: Array<{ title: string; url: string }> = []
  if (message.executed_tools) {
    for (const tool of message.executed_tools) {
      const results = tool.search_results?.results
      if (results) {
        for (const r of results) {
          if (r.title && r.url) {
            sources.push({ title: r.title, url: r.url })
          }
        }
      }
    }
  }

  return { content, sources: sources.slice(0, 5) }
}
