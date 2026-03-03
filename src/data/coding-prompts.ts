import type { CodingAgentPersona } from '@/types/coding-agent'

import { loadPrompt, listSkills, loadSkill } from '@/data/skill-loader'
import { getTemplate } from '@/config/e2bTemplates'
import { TEMPLATE_STRUCTURES } from '@/data/template-structures'

// Core skill auto-embedded per persona (no load_skill() call needed)
const PERSONA_CORE_SKILL: Record<string, string> = {
  frontend: 'frontend-design',
  backend: 'backend-dev',
}

export function buildSystemPrompt(
  persona: CodingAgentPersona,
  templateName: string,
  model?: string,
): string {
  const template = getTemplate(templateName)
  const workdir = template?.workdir || '/home/user/app'
  const devCmd = template?.devCmd || 'npm run dev'

  const parts: string[] = []

  // 1. Persona prompt — pick provider-specific variant if available
  //    e.g. "frontend" + openai model → try "frontend-openai" first, fall back to "frontend"
  const isOpenAI = model?.startsWith('openai/')
  const promptVariant = isOpenAI ? `${persona}-openai` : null
  const prompt = (promptVariant && loadPrompt(promptVariant)) || loadPrompt(persona)
  if (prompt) {
    parts.push(prompt.content)
  }

  // 2. Template structure — what's pre-installed in the sandbox
  const structure = TEMPLATE_STRUCTURES[templateName]
  if (structure) {
    parts.push(`\n\n${structure}`)
  } else {
    parts.push(
      `\n\n--- ENVIRONMENT ---\nTemplate: ${templateName}\nWorking directory: ${workdir}\nDev command: ${devCmd}\nDefault port: ${template?.defaultPort || 3000}`,
    )
  }

  // 3. Core skill for this persona (frontend-design / backend-dev)
  const coreSkillName = PERSONA_CORE_SKILL[persona]
  if (coreSkillName) {
    const skill = loadSkill(coreSkillName)
    if (skill) {
      parts.push(`\n\n--- ${coreSkillName.toUpperCase()} ---\n\n${skill.content}`)
    }
  }

  // 4. Available skills list — agent loads what it needs via load_skill()
  const allSkills = listSkills()
  if (allSkills.length > 0) {
    const skillList = allSkills
      .map((s) => `- \`${s.name}\`: ${s.description}`)
      .join('\n')
    parts.push(
      `\n\n--- AVAILABLE SKILLS ---\nUse load_skill("name") to load any of these before writing code for that framework:\n${skillList}`,
    )
  }

  return parts.join('')
}
