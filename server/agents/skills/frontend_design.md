---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Project Scaffolding

Use shell commands to initialize projects (`npx create-next-app`, `npx create-vite`, etc.). Don't manually write config files like `package.json`, `tsconfig.json`, or framework configs - let the CLI tools generate them correctly.

## Design Mode

If the user specifies a style or aesthetic, follow their direction. If they do NOT, pick ONE of these modes at random — vary your choice across projects:

- **Clean Minimal** — cheque elegant,Apple-like restraint, whitespace-driven, quiet confidence (this is the default if no style is specified most of times)
- **Editorial** — Magazine/print-inspired, type-forward, sophisticated
- **Warm Organic** — Earthy, natural, calm and inviting
- **Geometric Modern** — Swiss-inspired, precise, bold structure
- **Retro Craft** — Vintage feel, textured, handmade character
- **Soft Pastel** — Gentle, friendly, approachable
- **Dark Refined** — Premium, luxury, dramatic elegance
- **Brutalist** — Raw, bold, anti-design, unapologetic

Commit fully to the chosen mode. Every design decision should reinforce it. Don't mix modes.

## Design Thinking

Before coding, understand the context:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Let the design mode guide your aesthetic. Adapt it to the project's context.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What's the one detail someone will remember?

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

**Component Reuse**: Create shared components (buttons, inputs, cards, modals) ONCE in a dedicated file or section. Import and reuse them across pages—never rebuild the same UI element repeatedly. DRY code is clean code.

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use gradients as a primary design element. No gradient backgrounds, no gradient text, no gradient overlays. Gradients are the hallmark of generic AI-generated design. Use solid colors, textures, patterns, and contrast instead.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (purple/blue/cyan color palettes, neon accents on dark backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: You are capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.
