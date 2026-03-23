type SeoMetric = {
  label: string
  value: string
}

type SeoCard = {
  title: string
  description: string
}

type WorkflowExample = {
  title: string
  overview: string
  inputs: Array<string>
  steps: Array<string>
  outputs: Array<string>
  models: Array<string>
}

type SeoFaq = {
  question: string
  answer: string
}

type ComparisonRow = {
  label: string
  ayles: string
  competitor: string
}

type ComparisonSection = {
  competitorName: string
  intro: string
  rows: Array<ComparisonRow>
  recommendation: string
}

export type SeoPage = {
  slug: string
  title: string
  seoTitle: string
  description: string
  heroEyebrow: string
  heroHeadline: string
  heroSubheadline: string
  heroStats: Array<SeoMetric>
  whyTitle: string
  whyBody: string
  whyPoints: Array<string>
  workflow: WorkflowExample
  differentiators: Array<SeoCard>
  proofTitle: string
  proofCards: Array<SeoCard>
  useCases: Array<SeoCard>
  faqs: Array<SeoFaq>
  ctaLabel: string
  ctaNote: string
  relatedSlugs: Array<string>
  comparison?: ComparisonSection
}

export const SEO_PAGES: Array<SeoPage> = [
  {
    slug: 'ai-workflow-builder',
    title: 'AI Workflow Builder',
    seoTitle: 'AI Workflow Builder for Creative Teams | Ayles Flow',
    description:
      'Ayles Flow is an AI workflow builder for creative teams. Connect image, video, audio, text, research, and PDF steps in one visual flow instead of jumping between disconnected tools.',
    heroEyebrow: 'Category',
    heroHeadline: 'Build AI workflows on one visual canvas.',
    heroSubheadline:
      'Ayles Flow helps creative teams connect research, text, image, video, audio, music, and PDF steps into one reusable workflow instead of working inside isolated AI tools.',
    heroStats: [
      { label: 'Block types', value: '8+' },
      { label: 'Media scope', value: 'Multimodal' },
      { label: 'Workflow style', value: 'Connected canvas' },
      { label: 'Agent support', value: 'Built in' },
    ],
    whyTitle: 'Why teams start looking for an AI workflow builder',
    whyBody:
      'Most teams do not need another one-off generator. They need a system that keeps the whole production chain visible and reusable from brief to final asset.',
    whyPoints: [
      'Too many tabs create broken handoffs between research, writing, image, video, and delivery.',
      'Prompt history inside separate tools is not the same thing as a repeatable workflow.',
      'Creative leads need to see how outputs connect, not just approve isolated generations.',
      'Reusable workflows matter when one campaign becomes ten variations and multiple stakeholders.',
    ],
    workflow: {
      title: 'Campaign workflow on one canvas',
      overview:
        'Start with a brief, move into image and video generation, add soundtrack and narration, then finish with a PDF deliverable for review.',
      inputs: [
        'Creative brief',
        'Reference files or notes',
        'Team direction',
      ],
      steps: [
        'Write or drop the brief into the canvas',
        'Generate key image directions',
        'Connect the chosen image into a video step',
        'Add voiceover or music nodes',
        'Export a PDF summary for review',
      ],
      outputs: [
        'Hero image',
        'Short video cut',
        'Audio layer',
        'Final PDF brief',
      ],
      models: [
        'FLUX / Imagen',
        'Kling / video models',
        'ElevenLabs / TTS',
        'MiniMax Music',
      ],
    },
    differentiators: [
      {
        title: 'Connected multimodal flow',
        description:
          'One output becomes the next input. You can move from note to image to video to final deliverable without rebuilding context.',
      },
      {
        title: 'Visible workflow logic',
        description:
          'The canvas makes each step inspectable. Teams can understand the pipeline instead of reverse-engineering prompts from screenshots.',
      },
      {
        title: 'Agent-assisted setup',
        description:
          'The agent can add nodes, wire them together, and help teams move faster when they already know the job they need done.',
      },
      {
        title: 'Research to production handoff',
        description:
          'Ayles Flow is not limited to media generation. Teams can research, write, edit, generate media, and package outputs in the same system.',
      },
    ],
    proofTitle: 'What a real workflow page should prove',
    proofCards: [
      {
        title: 'One brief, many outputs',
        description:
          'A single brief can feed image, video, audio, and PDF steps instead of living as a disconnected text artifact.',
      },
      {
        title: 'Clear handoffs between steps',
        description:
          'Connected nodes make it obvious where an asset came from and what happens next inside the workflow.',
      },
      {
        title: 'Reusable patterns for teams',
        description:
          'Once a workflow is working, teams can keep the structure and iterate on direction instead of starting from zero every time.',
      },
    ],
    useCases: [
      {
        title: 'Campaign production',
        description:
          'Move from brief to hero image, video variation, soundtrack, and approval-ready document without leaving the canvas.',
      },
      {
        title: 'Creative operations',
        description:
          'Standardize repeatable workflows so output quality does not depend on one person remembering the right prompt order.',
      },
      {
        title: 'Agency delivery',
        description:
          'Keep the workflow visible for internal review and client handoff when campaigns require multiple media outputs.',
      },
    ],
    faqs: [
      {
        question: 'What makes an AI workflow builder different from a normal generator?',
        answer:
          'A workflow builder connects multiple steps together. Instead of making one isolated output, you keep the whole chain visible and reusable on a canvas.',
      },
      {
        question: 'Can Ayles Flow handle more than media generation?',
        answer:
          'Yes. Ayles Flow supports research, text editing, media generation, and PDF delivery, so the workflow can extend beyond one output type.',
      },
      {
        question: 'Is this only for advanced teams?',
        answer:
          'No. The canvas is visual, and the agent can help set up the graph when you want to move faster.',
      },
    ],
    ctaLabel: 'Start building your workflow',
    ctaNote:
      'Best for teams that want connected creative workflows instead of one-off generations.',
    relatedSlugs: [
      'visual-ai-workflow-builder',
      'image-to-video-workflow',
      'ai-content-workflow',
    ],
  },
  {
    slug: 'visual-ai-workflow-builder',
    title: 'Visual AI Workflow Builder',
    seoTitle: 'Visual AI Workflow Builder With a Connected Canvas | Ayles Flow',
    description:
      'Use a visual AI workflow builder to connect image, video, audio, text, research, and PDF steps on one canvas. Build repeatable creative workflows in Ayles Flow.',
    heroEyebrow: 'Canvas',
    heroHeadline: 'See your whole AI workflow on one canvas.',
    heroSubheadline:
      'Ayles Flow gives teams a visual AI workflow builder so they can inspect steps, connect outputs, and iterate on real pipelines instead of relying on chat history alone.',
    heroStats: [
      { label: 'Canvas style', value: 'Node based' },
      { label: 'Block types', value: '8+' },
      { label: 'Inputs/outputs', value: 'Connected' },
      { label: 'Team fit', value: 'Creative workflows' },
    ],
    whyTitle: 'Why visual workflow building matters',
    whyBody:
      'Chat is good for instructions. It is not a reliable interface for understanding complex creative production. A visual canvas gives teams a shared view of what the workflow is actually doing.',
    whyPoints: [
      'You can see upstream and downstream dependencies at a glance.',
      'Teams can inspect and refine the system without guessing what happened in a hidden conversation.',
      'The workflow remains reusable after one project, which matters for recurring campaign work.',
      'Visual context makes collaboration easier when different people own research, writing, and asset creation.',
    ],
    workflow: {
      title: 'Visual workflow example',
      overview:
        'Ayles Flow shows the full path from brief to production output so every step stays visible and editable.',
      inputs: ['Brief notes', 'Uploaded references', 'Team edits'],
      steps: [
        'Add note, text, image, video, audio, or PDF blocks',
        'Connect outputs to the next step',
        'Adjust prompts and structure on the canvas',
        'Run the workflow and inspect every result',
      ],
      outputs: [
        'Reusable workflow graph',
        'Generated assets',
        'Clear review path',
      ],
      models: ['Text, image, video, audio, and music models'],
    },
    differentiators: [
      {
        title: 'Not just another chat box',
        description:
          'The canvas is the source of truth. Teams can follow the flow instead of reconstructing it from a stream of messages.',
      },
      {
        title: 'Built for connected steps',
        description:
          'Blocks are designed to be wired together so downstream steps inherit the right context and assets.',
      },
      {
        title: 'Better review conversations',
        description:
          'When a team can point at the graph, feedback becomes concrete: change this node, refine this branch, rerun this output.',
      },
      {
        title: 'Creative iteration with structure',
        description:
          'The workflow stays flexible enough for experimentation while still being structured enough to repeat.',
      },
    ],
    proofTitle: 'What this page should make obvious',
    proofCards: [
      {
        title: 'The workflow is inspectable',
        description:
          'You can see the logic of the pipeline, not just the final asset.',
      },
      {
        title: 'The canvas supports handoff',
        description:
          'Different collaborators can work from the same visual system instead of translating intent across separate apps.',
      },
      {
        title: 'Reuse is built in',
        description:
          'A strong visual workflow becomes a starting point for the next project, not a one-time experiment.',
      },
    ],
    useCases: [
      {
        title: 'Creative reviews',
        description:
          'Use the canvas as the shared artifact in review meetings instead of piecing together context from exported files.',
      },
      {
        title: 'Workflow documentation',
        description:
          'A visible graph makes it easier to teach new teammates how a creative system works.',
      },
      {
        title: 'Repeatable production',
        description:
          'Keep one visual workflow structure and reuse it across campaign branches and deliverable types.',
      },
    ],
    faqs: [
      {
        question: 'Why does a visual AI workflow builder matter if chat can already create assets?',
        answer:
          'Because teams eventually need a shared system. A visual workflow shows dependencies, steps, and reusable structure in a way chat does not.',
      },
      {
        question: 'Can I connect multiple media types on the same canvas?',
        answer:
          'Yes. Ayles Flow supports image, video, audio, music, text, research, and PDF steps in one workflow.',
      },
      {
        question: 'Does the visual canvas slow teams down?',
        answer:
          'It usually does the opposite. Once the flow is visible, teams waste less time recreating steps and re-explaining the process.',
      },
    ],
    ctaLabel: 'See the canvas in action',
    ctaNote:
      'Best for teams that need a shared visual system, not just isolated AI outputs.',
    relatedSlugs: [
      'ai-workflow-builder',
      'image-to-video-workflow',
      'ai-content-workflow',
    ],
  },
  {
    slug: 'image-to-video-workflow',
    title: 'Image to Video Workflow',
    seoTitle: 'Image to Video Workflow for Creative Teams | Ayles Flow',
    description:
      'Build an image to video workflow in Ayles Flow. Generate or upload an image, connect it to video generation, add voiceover or music, and keep the full pipeline in one place.',
    heroEyebrow: 'Workflow',
    heroHeadline: 'Turn images into video inside one connected workflow.',
    heroSubheadline:
      'Ayles Flow helps teams move from image direction to video output on one canvas, then extend the workflow with narration, music, and final delivery steps.',
    heroStats: [
      { label: 'Start point', value: 'Generated or uploaded image' },
      { label: 'Next step', value: 'Video generation' },
      { label: 'Add-ons', value: 'Voiceover + music' },
      { label: 'Workflow fit', value: 'Campaign production' },
    ],
    whyTitle: 'Why teams need more than a one-click image to video tool',
    whyBody:
      'Image to video is rarely the whole job. Teams usually need a connected path from concept image to video variation to sound and stakeholder review.',
    whyPoints: [
      'A standalone tool can produce a clip, but it usually does not preserve the rest of the workflow.',
      'Creative teams need to connect direction, source assets, motion output, and review artifacts.',
      'When image-to-video is part of a larger campaign process, disconnected tools create friction fast.',
      'A connected workflow makes it easier to branch, compare, and reuse a winning direction.',
    ],
    workflow: {
      title: 'Image to video flow in Ayles Flow',
      overview:
        'Use an uploaded reference or a generated image as the first visual anchor, then connect it into motion and post-production steps.',
      inputs: ['Uploaded image', 'Generated image', 'Shot direction'],
      steps: [
        'Create or upload the source image',
        'Connect the image output into a video node',
        'Add voiceover or music if the clip needs audio',
        'Iterate the branch until the motion direction is approved',
      ],
      outputs: ['Motion clip', 'Audio-ready version', 'Reviewable workflow'],
      models: ['Image models', 'Image-to-video models', 'TTS', 'Music models'],
    },
    differentiators: [
      {
        title: 'Start from the image you already like',
        description:
          'The workflow preserves the image choice instead of treating every video generation like a separate tool and separate context.',
      },
      {
        title: 'Extend past the clip',
        description:
          'The same workflow can continue into audio, music, text notes, or a final document when the project needs more than one asset.',
      },
      {
        title: 'Branch and compare',
        description:
          'A visual workflow makes it easier to keep alternate motion directions without losing the original source and logic.',
      },
      {
        title: 'Keep the whole production chain',
        description:
          'Ayles Flow is useful when image to video is one step in a broader campaign or content process.',
      },
    ],
    proofTitle: 'What a strong image-to-video page should show',
    proofCards: [
      {
        title: 'Source image stays visible',
        description:
          'The team can see which image fed the video branch and keep that context attached to the output.',
      },
      {
        title: 'Video is part of a workflow',
        description:
          'The clip is not isolated from the rest of the project. It remains connected to briefs, edits, and follow-up steps.',
      },
      {
        title: 'Audio and review can happen in the same system',
        description:
          'The workflow can keep moving after the clip is generated instead of forcing another app handoff.',
      },
    ],
    useCases: [
      {
        title: 'Ad creative',
        description:
          'Turn approved image directions into motion variants without rebuilding the project from scratch.',
      },
      {
        title: 'Product teasers',
        description:
          'Take a product still or hero shot and turn it into a short motion asset with soundtrack and narration.',
      },
      {
        title: 'Social clips',
        description:
          'Generate fast visual motion while keeping the broader content workflow on one canvas.',
      },
    ],
    faqs: [
      {
        question: 'Can I upload an image and use it as the start of the workflow?',
        answer:
          'Yes. Ayles Flow supports uploaded files, so teams can start with an existing image rather than generating a new one first.',
      },
      {
        question: 'Can I add audio after the video step?',
        answer:
          'Yes. Ayles Flow supports connected audio and music nodes, so the workflow can continue after the video is created.',
      },
      {
        question: 'Why use a workflow page for image to video instead of a single generator page?',
        answer:
          'Because teams often need the surrounding context too: brief, source image, motion output, variants, and delivery steps.',
      },
    ],
    ctaLabel: 'Build an image-to-video workflow',
    ctaNote:
      'Best for teams that want motion as part of a connected creative pipeline.',
    relatedSlugs: [
      'ai-workflow-builder',
      'visual-ai-workflow-builder',
      'ai-content-workflow',
    ],
  },
  {
    slug: 'ai-content-workflow',
    title: 'AI Content Workflow',
    seoTitle: 'AI Content Workflow for Marketing and Creative Teams | Ayles Flow',
    description:
      'Ayles Flow helps teams run AI content workflows across research, writing, image generation, video, and final deliverables without bouncing across disconnected tools.',
    heroEyebrow: 'Use Case',
    heroHeadline: 'Run your content workflow in one connected AI system.',
    heroSubheadline:
      'Ayles Flow bridges research, writing, visual generation, and final delivery so content teams can keep the whole process in one workflow instead of rebuilding context between tools.',
    heroStats: [
      { label: 'Starts with', value: 'Research or brief' },
      { label: 'Moves through', value: 'Text + media' },
      { label: 'Ends with', value: 'Assets + PDF' },
      { label: 'Best for', value: 'Content teams' },
    ],
    whyTitle: 'Why AI content workflows break so easily',
    whyBody:
      'Content work usually spans more than one format. Teams research, write, edit, generate visuals, and package final deliverables. The handoffs become the real bottleneck.',
    whyPoints: [
      'The brief lives in one place, the draft in another, and the visuals in a third.',
      'It becomes hard to preserve the reasoning behind the final output when every step happened in a separate tool.',
      'Teams lose time re-explaining context to each new tool instead of building on a shared workflow.',
      'A connected workflow helps content teams stay aligned from research to final asset delivery.',
    ],
    workflow: {
      title: 'Content workflow example',
      overview:
        'Move from research and outlining into draft creation, visual support, and a final shareable deliverable without leaving the canvas.',
      inputs: ['Topic or brief', 'Research question', 'Reference files'],
      steps: [
        'Run research on the topic',
        'Turn findings into a working draft',
        'Edit and refine copy in the text editor',
        'Generate supporting images or media assets',
        'Package the result into a PDF or review-ready output',
      ],
      outputs: ['Structured research', 'Draft content', 'Visual assets', 'Final deliverable'],
      models: ['Research agent', 'Text generation', 'Image/video models', 'PDF export'],
    },
    differentiators: [
      {
        title: 'Research, writing, and media on one canvas',
        description:
          'Ayles Flow is useful when content work needs both text quality and media support inside the same workflow.',
      },
      {
        title: 'Editor plus workflow context',
        description:
          'The text editor is connected to the broader system, so writing is part of the workflow instead of a disconnected afterthought.',
      },
      {
        title: 'Useful for production, not just ideation',
        description:
          'The workflow can end in a real deliverable, including a PDF export, rather than stopping at a loose draft.',
      },
      {
        title: 'More than content in the narrow sense',
        description:
          'Ayles Flow is a good fit when content means research, copy, visuals, and handoff artifacts together.',
      },
    ],
    proofTitle: 'What this page should make believable',
    proofCards: [
      {
        title: 'The workflow covers the whole content chain',
        description:
          'Ayles Flow can move from source research to a polished deliverable without splitting the project across separate tools.',
      },
      {
        title: 'The editor is part of the system',
        description:
          'Text editing, workflow logic, and final outputs stay connected instead of being scattered.',
      },
      {
        title: 'Visuals can join the same process',
        description:
          'When a team needs media alongside copy, the assets can stay attached to the content workflow.',
      },
    ],
    useCases: [
      {
        title: 'Marketing teams',
        description:
          'Research a topic, draft the message, add visuals, and package a final review-ready deliverable inside one workflow.',
      },
      {
        title: 'Agency content production',
        description:
          'Keep briefs, drafts, assets, and final handoff materials connected for faster review and revision cycles.',
      },
      {
        title: 'Thought leadership and reports',
        description:
          'Combine research, structured writing, and presentation-ready export when the deliverable needs more than a chat response.',
      },
    ],
    faqs: [
      {
        question: 'Is Ayles Flow only for written content?',
        answer:
          'No. The content workflow can include research, text editing, visuals, audio, and final PDF output when the project needs more than copy alone.',
      },
      {
        question: 'Can content teams use Ayles Flow without building giant workflows?',
        answer:
          'Yes. Teams can start with a simple research-and-draft flow and add more steps only when the process needs them.',
      },
      {
        question: 'Why is this different from using separate AI writing and image tools?',
        answer:
          'Because the workflow stays connected. Research, draft logic, media generation, and delivery all live in the same system.',
      },
    ],
    ctaLabel: 'Build your content workflow',
    ctaNote:
      'Best for teams that need connected research, writing, and media production.',
    relatedSlugs: [
      'ai-workflow-builder',
      'ai-research-report-generator',
      'visual-ai-workflow-builder',
    ],
  },
  {
    slug: 'ai-research-report-generator',
    title: 'AI Research Report Generator',
    seoTitle:
      'AI Research Report Generator With Citations and PDF Export | Ayles Flow',
    description:
      'Use Ayles Flow to generate research reports with citations, refine them in the editor, and export final PDFs as part of one connected workflow.',
    heroEyebrow: 'Research',
    heroHeadline: 'Generate cited research reports and turn them into PDFs.',
    heroSubheadline:
      'Ayles Flow runs multi-step research, synthesizes structured findings with citations, lets teams refine the draft, and exports a final PDF without breaking the workflow.',
    heroStats: [
      { label: 'Research style', value: 'Multi pass' },
      { label: 'Evidence', value: 'Citations' },
      { label: 'Editor', value: 'Built in' },
      { label: 'Final output', value: 'PDF ready' },
    ],
    whyTitle: 'Why generic AI research output is not enough',
    whyBody:
      'Teams do not just need a paragraph back from a model. They need a report they can inspect, refine, cite, and hand off to stakeholders.',
    whyPoints: [
      'One-shot answers often skip the search depth buyers expect in real decision support.',
      'Citations matter when the output needs trust and not just speed.',
      'Research becomes more useful when it flows directly into editing and final delivery.',
      'A report generator is stronger when it behaves like a workflow, not a single response box.',
    ],
    workflow: {
      title: 'Research report workflow',
      overview:
        'Start with a question, run multi-step research, synthesize findings, refine the draft, and export the final report.',
      inputs: ['Research question', 'Decision context', 'Scope notes'],
      steps: [
        'Generate diverse search angles',
        'Read and synthesize source material',
        'Produce a structured report with citations',
        'Refine the draft in the editor',
        'Export the final PDF deliverable',
      ],
      outputs: ['Structured report', 'Citations', 'Refined draft', 'Final PDF'],
      models: ['Research agent', 'Text synthesis', 'PDF generation'],
    },
    differentiators: [
      {
        title: 'Research happens in multiple passes',
        description:
          'Ayles Flow can search from several angles, spot missing context, and synthesize a more structured result than a one-shot answer.',
      },
      {
        title: 'Reports stay editable',
        description:
          'The output can be refined in the editor instead of being trapped as a disposable chat response.',
      },
      {
        title: 'Citations survive into the deliverable',
        description:
          'A cited report is more useful for teams that need to review the evidence or package it for decision makers.',
      },
      {
        title: 'PDF export is part of the same workflow',
        description:
          'The workflow can end in a review-ready document without exporting raw text to another tool first.',
      },
    ],
    proofTitle: 'What this page should prove',
    proofCards: [
      {
        title: 'The report is structured',
        description:
          'Buyers should see that the output includes organization, synthesis, and citations rather than a loose answer blob.',
      },
      {
        title: 'The editor matters',
        description:
          'The report can be refined before delivery, which is critical for stakeholder-facing work.',
      },
      {
        title: 'PDF export closes the loop',
        description:
          'A strong research workflow should end in a format teams can actually circulate.',
      },
    ],
    useCases: [
      {
        title: 'Competitor research',
        description:
          'Turn a market or competitor question into a cited internal report that can be reviewed and shared.',
      },
      {
        title: 'Executive briefs',
        description:
          'Use Ayles Flow when the research output needs to become a polished PDF rather than staying inside a chat.',
      },
      {
        title: 'Content research and synthesis',
        description:
          'Collect evidence, organize it, and feed the result into a broader content or creative workflow.',
      },
    ],
    faqs: [
      {
        question: 'Does Ayles Flow include citations in the report output?',
        answer:
          'Yes. The research workflow is built around cited synthesis so teams can review the sources alongside the findings.',
      },
      {
        question: 'Can I edit the report before exporting it?',
        answer:
          'Yes. The report can be refined in the editor before it becomes a PDF deliverable.',
      },
      {
        question: 'Why is this useful if other tools can answer research questions too?',
        answer:
          'Because Ayles Flow treats research as a workflow with citations, editing, and final delivery rather than as a one-off answer.',
      },
    ],
    ctaLabel: 'Generate a research report',
    ctaNote:
      'Best for teams that need cited research and a delivery-ready document, not just a fast answer.',
    relatedSlugs: [
      'ai-content-workflow',
      'ai-workflow-builder',
      'visual-ai-workflow-builder',
    ],
  },
]

export function getSeoPageBySlug(slug: string) {
  return SEO_PAGES.find((page) => page.slug === slug)
}

export function getSeoPagePath(slug: string) {
  return `/${slug}`
}
