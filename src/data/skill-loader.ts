// Skill & prompt loader — bundles all .md files at build time via import.meta.glob
// Works on Cloudflare Workers (no fs access needed)

// Bundle all skill files at build time as raw strings
const skillModules = import.meta.glob(
  '../../server/agents/skills/**/*.md',
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

// Bundle all prompt files at build time as raw strings
const promptModules = import.meta.glob(
  '../../server/agents/prompts/*.md',
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

// --- Frontmatter parsing ---

type Frontmatter = {
  name?: string
  description?: string
  skills?: string[]
}

function parseFrontmatter(content: string): {
  metadata: Frontmatter
  body: string
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { metadata: {}, body: content }

  const raw = match[1]
  const body = match[2].trimStart()
  const metadata: Frontmatter = {}

  for (const line of raw.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (kv) {
      const [, key, value] = kv
      if (key === 'name') metadata.name = value.trim()
      if (key === 'description') metadata.description = value.trim()
    }
  }

  // Parse skills array (YAML list format)
  const skillsMatch = raw.match(/skills:\n((?:\s+-\s+.+\n?)+)/)
  if (skillsMatch) {
    metadata.skills = skillsMatch[1]
      .split('\n')
      .map((l) => l.replace(/^\s+-\s+/, '').trim())
      .filter(Boolean)
  } else {
    // Single-line skills
    const singleSkill = raw.match(/skills:\s+(.+)/)
    if (singleSkill) {
      metadata.skills = [singleSkill[1].trim()]
    }
  }

  return { metadata, body }
}

// --- Skill name → content mapping ---

// Build a map of skill name → file content
// Derives skill name from filename: backend_dev.md → backend-dev, convex.md → convex
function buildSkillRegistry(): Map<
  string,
  { content: string; metadata: Frontmatter }
> {
  const registry = new Map<
    string,
    { content: string; metadata: Frontmatter }
  >()

  for (const [path, raw] of Object.entries(skillModules)) {
    // Skip index.md
    if (path.endsWith('index.md')) continue

    const { metadata, body } = parseFrontmatter(raw)

    // Use frontmatter name if available, otherwise derive from filename
    const filename = path.split('/').pop()!.replace('.md', '')
    const name = metadata.name || filename.replace(/_/g, '-')

    registry.set(name, { content: body, metadata })
  }

  return registry
}

const SKILL_REGISTRY = buildSkillRegistry()

// --- Public API ---

export function loadSkill(
  name: string,
): { content: string; metadata: Frontmatter } | null {
  return SKILL_REGISTRY.get(name) ?? null
}

export function listSkills(): Array<{ name: string; description: string }> {
  const skills: Array<{ name: string; description: string }> = []
  for (const [name, { metadata }] of SKILL_REGISTRY) {
    skills.push({
      name,
      description: metadata.description || '',
    })
  }
  return skills
}

export function loadPrompt(
  persona: string,
): { content: string; metadata: Frontmatter } | null {
  for (const [path, raw] of Object.entries(promptModules)) {
    const filename = path.split('/').pop()!.replace('.md', '')
    if (filename === persona) {
      const { metadata, body } = parseFrontmatter(raw)
      return { content: body, metadata }
    }
  }
  return null
}
