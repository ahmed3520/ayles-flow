export type FeatureIconKey = 'network' | 'bot' | 'globe' | 'type' | 'image'

type FeatureCard = {
  title: string
  description: string
}

type FeatureMetric = {
  label: string
  value: string
}

export type FeaturePage = {
  slug: string
  icon: FeatureIconKey
  title: string
  seoTitle: string
  description: string
  summary: string
  heroEyebrow: string
  heroHeadline: string
  heroSubheadline: string
  metrics: Array<FeatureMetric>
  highlights: Array<FeatureCard>
  workflowSteps: Array<FeatureCard>
  useCases: Array<FeatureCard>
  faqs: Array<{
    question: string
    answer: string
  }>
}

export const FEATURE_PAGES: Array<FeaturePage> = [
  {
    slug: 'visual-canvas',
    icon: 'network',
    title: 'Visual AI Canvas',
    seoTitle: 'Visual AI Canvas for Multimodal Workflows | Ayles Flow',
    description:
      'Build AI workflows on a visual canvas. Drop blocks for image, video, audio, music, text, and PDF — then wire them into real pipelines.',
    summary:
      'Drag blocks, wire connections, run pipelines. One canvas for every AI workflow.',
    heroEyebrow: 'Visual Canvas',
    heroHeadline: 'Your entire AI pipeline, on one canvas.',
    heroSubheadline:
      'Drop image, video, audio, music, and text blocks. Wire outputs to inputs. Hit generate. The canvas handles the rest.',
    metrics: [
      { label: 'Block types', value: '8+' },
      { label: 'Scope', value: 'Multimodal' },
      { label: 'Building', value: 'Visual blocks' },
      { label: 'Projects', value: 'Unlimited' },
    ],
    highlights: [
      {
        title: 'Drag-and-drop blocks',
        description:
          'Image, video, audio, music, text, notes, tickets, and PDF — every block type on a single canvas.',
      },
      {
        title: 'Wire real pipelines',
        description:
          'Connect outputs to inputs across blocks. One model feeds the next automatically.',
      },
      {
        title: 'Notes and tickets',
        description:
          'Add creative briefs with colored notes and track tasks with tickets that have status, priority, and tags.',
      },
      {
        title: 'Version history',
        description:
          'Save snapshots, undo changes, and restore any previous state of your project.',
      },
    ],
    workflowSteps: [
      {
        title: 'Drop blocks',
        description:
          'Add image, video, audio, music, text, or upload blocks from the toolbar.',
      },
      {
        title: 'Wire connections',
        description:
          'Drag from output ports to input ports to chain models into a pipeline.',
      },
      {
        title: 'Generate',
        description:
          'Hit run. Results land on canvas. Download them or pipe into the next step.',
      },
    ],
    useCases: [
      {
        title: 'Campaign pipelines',
        description:
          'Brief → image → video → music — one connected workflow for the whole campaign.',
      },
      {
        title: 'Research to deliverable',
        description:
          'Research → write → PDF. Go from question to shareable document without switching tools.',
      },
      {
        title: 'Team workflows',
        description:
          "Standardize repeatable pipelines so quality doesn't depend on one person.",
      },
    ],
    faqs: [
      {
        question: 'Do I need to code?',
        answer: 'No. Everything is visual. Drag blocks, connect them, and run.',
      },
      {
        question: 'Can I use multiple AI providers in one workflow?',
        answer:
          'Yes. Each block picks the best model for that step — mix providers freely.',
      },
      {
        question: 'Can I start from uploaded files?',
        answer:
          'Yes. Upload images, audio, video, or PDFs and use them as pipeline inputs.',
      },
    ],
  },
  {
    slug: 'text-editor',
    icon: 'type',
    title: 'AI Text Editor',
    seoTitle: 'AI-Powered Rich Text Editor with Slash Commands | Ayles Flow',
    description:
      'Write and edit with a rich text editor that has AI helpers built in. Slash commands, selection actions, formatting, and version history — all on the canvas.',
    summary:
      'Rich text editing with AI helpers, slash commands, and version history — right on the canvas.',
    heroEyebrow: 'Text Editor',
    heroHeadline: 'Write smarter with AI built into every paragraph.',
    heroSubheadline:
      'Full rich text editor with slash commands for quick formatting, AI selection helpers that rewrite, summarize, expand, and fix — plus version history so you never lose work.',
    metrics: [
      { label: 'Formatting', value: 'Full rich text' },
      { label: 'AI actions', value: '5 built-in' },
      { label: 'History', value: 'Auto-versioned' },
      { label: 'Integration', value: 'Canvas-native' },
    ],
    highlights: [
      {
        title: 'Slash commands',
        description:
          'Type / to access headings, lists, code blocks, tables, blockquotes, and more — without leaving the keyboard.',
      },
      {
        title: 'AI selection helpers',
        description:
          'Select text and choose Summarize, Rewrite, Shorten, Expand, or Fix. The AI edits inline.',
      },
      {
        title: 'Version history',
        description:
          'Every edit is auto-versioned. Restore any previous version with one click.',
      },
      {
        title: 'Agent integration',
        description:
          'The AI agent can read and edit your text — insert, replace, or format content directly.',
      },
    ],
    workflowSteps: [
      {
        title: 'Open a text block',
        description:
          'Double-click any text node to open the full editor workspace.',
      },
      {
        title: 'Write with AI help',
        description:
          'Use slash commands for structure, select text for AI actions like rewrite or expand.',
      },
      {
        title: 'Version and export',
        description:
          'Auto-saved versions let you go back anytime. Export to PDF or pipe into downstream blocks.',
      },
    ],
    useCases: [
      {
        title: 'Long-form content',
        description:
          'Write articles, reports, and docs with AI assistance at every step.',
      },
      {
        title: 'Research synthesis',
        description:
          'Take deep research output and refine it into polished deliverables.',
      },
      {
        title: 'Team documentation',
        description:
          'Collaborative editing with version history so nothing gets lost.',
      },
    ],
    faqs: [
      {
        question: 'What formatting does the editor support?',
        answer:
          'Headings, bold, italic, code, lists, blockquotes, code blocks, and tables.',
      },
      {
        question: 'Can the AI agent edit my text?',
        answer:
          'Yes. The agent can insert, replace, delete, and format text in the editor.',
      },
      {
        question: 'Is version history automatic?',
        answer:
          'Yes. Every change is auto-saved with full version history you can browse and restore.',
      },
    ],
  },
  {
    slug: 'ai-agent',
    icon: 'bot',
    title: 'AI Agent',
    seoTitle: 'AI Agent for Canvas Workflow Automation | Ayles Flow',
    description:
      'Tell the AI agent what to build. It creates blocks, wires nodes, picks models, runs research, generates PDFs, and edits your text — all on the canvas.',
    summary:
      'Describe what you need. The agent builds the entire workflow on your canvas.',
    heroEyebrow: 'AI Agent',
    heroHeadline: 'Describe it once. The agent builds it.',
    heroSubheadline:
      'The agent creates nodes, wires connections, selects models, runs deep research, generates PDFs, and edits text — from a single message.',
    metrics: [
      { label: 'Input', value: 'Natural language' },
      { label: 'Scope', value: 'Full canvas control' },
      { label: 'Research', value: 'Built-in' },
      { label: 'Models', value: '6+ agent models' },
    ],
    highlights: [
      {
        title: 'Canvas actions',
        description:
          'Add nodes, connect them, update prompts, delete blocks, clear canvas — the agent has full read/write access.',
      },
      {
        title: 'Model selection',
        description:
          'Choose from Claude Opus, Claude Sonnet, MiniMax, GLM, Kimi, and more for the agent itself.',
      },
      {
        title: 'Research mode',
        description:
          'Toggle deep research — the agent searches the web, reads sources, and synthesizes findings.',
      },
      {
        title: 'Text editor integration',
        description:
          'The agent reads and edits your open text editor — insert, replace, format, and restructure content.',
      },
    ],
    workflowSteps: [
      {
        title: 'Give one instruction',
        description:
          'Tell the agent what you need: "Build a research pipeline with image and video output."',
      },
      {
        title: 'Agent builds the graph',
        description:
          'It adds blocks, maps connections, configures prompts, and picks models.',
      },
      {
        title: 'Refine and run',
        description:
          'Follow up with adjustments. The agent keeps context and iterates with you.',
      },
    ],
    useCases: [
      {
        title: 'Instant workflow setup',
        description:
          'Skip manual block-by-block building. Describe the pipeline and let the agent assemble it.',
      },
      {
        title: 'Research-to-deliverable',
        description:
          'Ask the agent to research a topic, write a report, and generate a PDF — all in one flow.',
      },
      {
        title: 'Text editing assistant',
        description:
          'Use the agent to rewrite, restructure, or extend content in your text editor.',
      },
    ],
    faqs: [
      {
        question: 'Can the agent build complete workflows?',
        answer:
          'Yes. It assembles full node graphs with connections, not just isolated suggestions.',
      },
      {
        question: 'Can it modify existing projects?',
        answer:
          'Yes. It can restructure nodes, update prompts, and rewire connections on an existing canvas.',
      },
      {
        question: 'What models power the agent?',
        answer:
          'Claude Opus 4.6, Claude Sonnet 4.6, MiniMax M2.1, GLM 5, Kimi K2.5, and Quasar v1 (coming soon).',
      },
    ],
  },
  {
    slug: 'deep-research',
    icon: 'globe',
    title: 'Deep Research',
    seoTitle: 'Deep Research Agent with Web Search and Citations | Ayles Flow',
    description:
      'Run multi-step web research inside Ayles Flow. The agent searches multiple angles, reads sources, runs follow-up queries, and delivers structured reports with citations.',
    summary:
      'Multi-step web research that delivers structured findings with real citations.',
    heroEyebrow: 'Deep Research',
    heroHeadline: 'From question to cited research in one workflow.',
    heroSubheadline:
      'The research agent searches the web from multiple angles, reads sources, identifies gaps, runs follow-up queries, and synthesizes structured reports with citations.',
    metrics: [
      { label: 'Research', value: 'Multi-pass' },
      { label: 'Evidence', value: 'Cited sources' },
      { label: 'Output', value: 'Structured report' },
      { label: 'Next step', value: 'PDF-ready' },
    ],
    highlights: [
      {
        title: 'Multi-angle search',
        description:
          'Research starts from diverse query directions to avoid single-source bias.',
      },
      {
        title: 'Gap-aware follow-ups',
        description:
          'The agent spots missing context and runs additional searches before synthesis.',
      },
      {
        title: 'Structured output',
        description:
          'Findings are delivered as structured reports on canvas — not disposable chat messages.',
      },
      {
        title: 'Pipeline-ready',
        description:
          'Research output feeds directly into text editing, writing, and PDF generation.',
      },
    ],
    workflowSteps: [
      {
        title: 'Ask the question',
        description:
          'Tell the agent what needs a decision-grade answer and how deep to go.',
      },
      {
        title: 'Agent researches',
        description:
          'It searches the web, reads pages, follows gaps, and builds a structured report.',
      },
      {
        title: 'Use the output',
        description:
          'Edit the report in the text editor, refine it, or export as PDF.',
      },
    ],
    useCases: [
      {
        title: 'Market analysis',
        description:
          'Source-backed scans for product positioning, pricing, and competitive strategy.',
      },
      {
        title: 'Content research',
        description:
          'Collect references, trends, and context before building creative workflows.',
      },
      {
        title: 'Decision support',
        description:
          'Structured research reports that teams can review and act on quickly.',
      },
    ],
    faqs: [
      {
        question: 'Does the output include sources?',
        answer:
          'Yes. Research reports preserve source URLs and citation context.',
      },
      {
        question: 'Can I turn research into a PDF?',
        answer:
          'Yes. Research output feeds directly into the PDF generation workflow.',
      },
      {
        question: 'Is this just a chatbot search?',
        answer:
          'No. It runs multi-pass research with follow-up queries, gap detection, and structured synthesis.',
      },
    ],
  },
  {
    slug: 'media-generation',
    icon: 'image',
    title: 'Media Generation',
    seoTitle:
      'AI Media Generation for Image, Video, Audio, and Music | Ayles Flow',
    description:
      'Generate images, videos, audio, and music from text prompts. Use models from Quasar, Google, OpenAI, Black Forest Labs, Kling, MiniMax, ElevenLabs, and more.',
    summary:
      'Image, video, audio, and music generation from leading AI providers — all on one canvas.',
    heroEyebrow: 'Media Generation',
    heroHeadline: 'Every media type. Best models. One canvas.',
    heroSubheadline:
      'Generate images with FLUX and Imagen, videos with Kling, music with MiniMax, audio with ElevenLabs — plus upscale, remove backgrounds, and chain outputs.',
    metrics: [
      { label: 'Media types', value: 'Image, Video, Audio, Music' },
      { label: 'Providers', value: '8+' },
      { label: 'Image tools', value: 'Upscale, BG Remove' },
      { label: 'Pipelines', value: 'Cross-modal' },
    ],
    highlights: [
      {
        title: 'Multi-provider models',
        description:
          'FLUX 1.1 Pro, Imagen 4, GPT Image, Kling Video, MiniMax Music, ElevenLabs, Recraft, and more.',
      },
      {
        title: 'Image tools',
        description:
          'Upscale 2x, remove backgrounds, rotate, flip, and reset — built into every image block.',
      },
      {
        title: 'Cross-modal pipelines',
        description:
          'Wire image output to video input, text to audio, or chain any combination across media types.',
      },
      {
        title: 'Upload and transform',
        description:
          'Bring your own images, audio, or video and process them through downstream generation blocks.',
      },
    ],
    workflowSteps: [
      {
        title: 'Choose a block type',
        description:
          'Add image, video, audio, or music blocks from the canvas toolbar.',
      },
      {
        title: 'Pick a model and prompt',
        description:
          'Select the best model for each task and write your prompt.',
      },
      {
        title: 'Generate and chain',
        description:
          'Results land on canvas. Download them, post-process them, or wire into the next block.',
      },
    ],
    useCases: [
      {
        title: 'Social media content',
        description:
          'Generate coordinated images, short videos, and audio from one prompt.',
      },
      {
        title: 'Product visuals',
        description:
          'Create hero images, upscale them, remove backgrounds, and produce video variants.',
      },
      {
        title: 'Audio and music',
        description:
          'Generate voiceovers with ElevenLabs and music beds with MiniMax in the same project.',
      },
    ],
    faqs: [
      {
        question: 'What image models are available?',
        answer:
          'FLUX 1.1 Pro Ultra, Imagen 4, GPT Image, Recraft Image, and more — with new models added regularly.',
      },
      {
        question: 'Can I chain image to video?',
        answer:
          'Yes. Wire an image block output to a video block input to create video from your generated image.',
      },
      {
        question: 'Can I upload my own files?',
        answer:
          'Yes. Upload images, audio, video, or PDFs and use them as inputs in any pipeline.',
      },
    ],
  },
]

export function getFeaturePagePath(slug: string) {
  return `/features/${slug}` as const
}

export function getFeaturePageBySlug(slug: string) {
  return FEATURE_PAGES.find((page) => page.slug === slug)
}
