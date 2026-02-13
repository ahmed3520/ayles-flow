import type OpenAI from 'openai'

import { groqWeb } from '@/data/groq'

export type ResearchResult = {
  title: string
  markdown: string
  summary: string
  sources: Array<{ title: string; url: string }>
}

type StatusWriter = (phase: string, detail?: string) => Promise<void>

function parseJsonQueries(text: string): Array<string> {
  const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '')
  const jsonMatch =
    cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []
  try {
    const parsed = JSON.parse(jsonMatch[0])
    const arr = Array.isArray(parsed) ? parsed : parsed.queries
    if (Array.isArray(arr)) return arr.filter((q: unknown) => typeof q === 'string')
  } catch {
    // noop
  }
  return []
}

export async function deepResearch(
  topic: string,
  client: OpenAI,
  model: string,
  writeStatus: StatusWriter,
): Promise<ResearchResult> {
  const allSources: Array<{ title: string; url: string }> = []
  const allContent: Array<string> = []

  const addSources = (sources: Array<{ title: string; url: string }>) => {
    for (const s of sources) {
      if (!allSources.some((existing) => existing.url === s.url)) {
        allSources.push(s)
      }
    }
  }

  // --- Phase 1: Generate search queries ---
  await writeStatus('Generating search queries...')

  let initialQueries: Array<string> = []
  try {
    const queryGenResponse = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Generate 4-5 diverse search queries to thoroughly research the given topic. Return ONLY a JSON array of strings like: ["query 1", "query 2", "query 3", "query 4"]. Cover different angles: definitions, latest developments, expert opinions, comparisons, practical applications. Return ONLY the JSON array, nothing else.',
        },
        { role: 'user', content: topic },
      ],
    })
    const raw = queryGenResponse.choices[0]?.message.content || ''
    initialQueries = parseJsonQueries(raw)
  } catch {
    // LLM call failed
  }

  if (initialQueries.length < 2) {
    initialQueries = [
      topic,
      `${topic} latest developments 2025`,
      `${topic} expert analysis`,
      `${topic} pros and cons comparison`,
    ]
  }

  // --- Phase 2: Execute initial searches in parallel ---
  await writeStatus(
    'Searching the web...',
    `${initialQueries.length} queries`,
  )

  const initialResults = await Promise.allSettled(
    initialQueries.map(async (q, i) => {
      await writeStatus(
        'Searching the web...',
        `(${i + 1}/${initialQueries.length}) ${q}`,
      )
      return groqWeb(q)
    }),
  )

  for (const r of initialResults) {
    if (r.status === 'fulfilled') {
      allContent.push(r.value.content)
      addSources(r.value.sources)
    }
  }

  // --- Phase 3: Analyze results, generate follow-up queries ---
  await writeStatus('Analyzing initial findings...')

  let followUpQueries: Array<string> = []
  try {
    const followUpResponse = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a research analyst. Based on the initial research findings below, identify gaps and generate 2-3 follow-up search queries to fill those gaps. Return ONLY a JSON array of query strings like: ["query 1", "query 2"]. Return ONLY the JSON array, nothing else.',
        },
        {
          role: 'user',
          content: `Topic: ${topic}\n\nInitial findings:\n${allContent.join('\n\n---\n\n')}`,
        },
      ],
    })
    const raw = followUpResponse.choices[0]?.message.content || ''
    followUpQueries = parseJsonQueries(raw)
  } catch {
    // Follow-up generation failed, skip
  }

  // --- Phase 4: Execute follow-up searches ---
  if (followUpQueries.length > 0) {
    await writeStatus(
      'Deeper research...',
      `${followUpQueries.length} follow-up queries`,
    )

    const followUpResults = await Promise.allSettled(
      followUpQueries.map(async (q, i) => {
        await writeStatus(
          'Deeper research...',
          `(${i + 1}/${followUpQueries.length}) ${q}`,
        )
        return groqWeb(q)
      }),
    )

    for (const r of followUpResults) {
      if (r.status === 'fulfilled') {
        allContent.push(r.value.content)
        addSources(r.value.sources)
      }
    }
  }

  // --- Phase 5: Synthesize structured document ---
  await writeStatus('Synthesizing research document...')

  const sourcesList = allSources
    .map((s, i) => `[${i + 1}] ${s.title} - ${s.url}`)
    .join('\n')

  const synthesisResponse = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a research writer. Synthesize the following research findings into a well-structured document.

Requirements:
- Start with a clear title (# Title)
- Include an executive summary section (## Executive Summary)
- Organize into logical sections with ## headings
- Use inline citations referencing source numbers like [1], [2], etc.
- End with a "## Sources" section listing all numbered sources
- Be thorough but concise — aim for 800-1500 words
- Use markdown formatting (bold, lists, etc.) for readability
- Be factual and objective

Available sources for citation:
${sourcesList}`,
      },
      {
        role: 'user',
        content: `Topic: ${topic}\n\nResearch findings:\n${allContent.join('\n\n---\n\n')}`,
      },
    ],
  })

  const markdown = synthesisResponse.choices[0]?.message.content || ''

  // Extract title from markdown
  const titleMatch = markdown.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1] : `Research: ${topic}`

  // --- Phase 6: Generate brief summary ---
  await writeStatus('Generating summary...')

  const summaryResponse = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'Summarize this research document in 2-3 sentences. Be concise and highlight the key findings.',
      },
      { role: 'user', content: markdown },
    ],
  })
  const summary = summaryResponse.choices[0]?.message.content || ''

  await writeStatus('Research complete!')

  return {
    title,
    markdown,
    summary,
    sources: allSources.slice(0, 15),
  }
}
