import type OpenAI from 'openai'

import type { AvailableModel, CanvasEdge, CanvasNode } from '@/types/agent'

// --- Tool definitions (OpenAI function calling format) ---

export const tools: Array<OpenAI.ChatCompletionTool> = [
  // --- Read tools (no side effects, just return data) ---
  {
    type: 'function',
    function: {
      name: 'get_canvas_state',
      description:
        'Get full canvas state: all nodes (with id, type, prompt, model, status, position, and result presence) and all edges. Use this when the runtime snapshot is insufficient.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_models',
      description:
        'Get the full list of available AI models grouped by category (text-to-image, image-to-image, text-to-video, image-to-video, audio/TTS, music). Each model shows falId, input types, and output type. Use when you need exact model IDs or capabilities.',
      parameters: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['image', 'video', 'audio', 'music'],
            description:
              'Optional: filter models by content type. Omit to get all models.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the web or visit a URL for real-time information. If the query is a URL, fetches and summarizes that page. Otherwise, searches the web and returns results with source citations. Use this when you need current data, to look up documentation, or when the user provides a URL.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'The search query or URL to visit. Examples: "latest flux model capabilities", "https://docs.fal.ai/models"',
          },
        },
        required: ['query'],
      },
    },
  },
  // --- Write tools (modify the canvas) ---
  {
    type: 'function',
    function: {
      name: 'add_node',
      description:
        'Add a new node to the canvas. Use this to create generation blocks (image, video, audio, music), utility blocks (text, note), or a website preview node (website).',
      parameters: {
        type: 'object',
        properties: {
          contentType: {
            type: 'string',
            enum: ['image', 'video', 'audio', 'music', 'text', 'note', 'website'],
            description: 'The type of content this node produces. Use "website" for live sandbox preview.',
          },
          prompt: {
            type: 'string',
            description: 'The prompt or text content for the node',
          },
          model: {
            type: 'string',
            description:
              'The fal.ai model ID to use (e.g. "fal-ai/flux-pro/v1.1-ultra"). Must match the contentType.',
          },
          label: {
            type: 'string',
            description: 'Display label for the node',
          },
          x: {
            type: 'number',
            description:
              'X position on canvas. Space nodes ~300px apart horizontally.',
          },
          y: {
            type: 'number',
            description:
              'Y position on canvas. Space nodes ~200px apart vertically.',
          },
          previewUrl: {
            type: 'string',
            description: 'Live preview URL for website nodes (from create_sandbox result).',
          },
          sandboxId: {
            type: 'string',
            description: 'E2B sandbox ID for website nodes.',
          },
        },
        required: ['contentType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'connect_nodes',
      description:
        'Connect two nodes with an edge. The source node output type must match the target node input type.',
      parameters: {
        type: 'object',
        properties: {
          sourceNodeId: {
            type: 'string',
            description: 'ID of the source node (output side)',
          },
          targetNodeId: {
            type: 'string',
            description: 'ID of the target node (input side)',
          },
          portType: {
            type: 'string',
            enum: ['text', 'image', 'audio', 'video', 'pdf'],
            description:
              'The port type for the connection. Must exist on both source output and target input.',
          },
        },
        required: ['sourceNodeId', 'targetNodeId', 'portType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_node',
      description:
        "Update an existing IDLE node's prompt, model, or label. Only use on nodes that have NOT been generated yet (status=idle).",
      parameters: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'string',
            description: 'ID of the node to update',
          },
          prompt: { type: 'string', description: 'New prompt text' },
          model: { type: 'string', description: 'New model falId' },
          label: { type: 'string', description: 'New display label' },
        },
        required: ['nodeId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_nodes',
      description:
        'Delete one or more nodes and their connected edges from the canvas.',
      parameters: {
        type: 'object',
        properties: {
          nodeIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of node IDs to delete',
          },
        },
        required: ['nodeIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_canvas',
      description:
        'Remove ALL nodes and edges from the canvas. Use with caution.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // --- Research & document tools ---
  {
    type: 'function',
    function: {
      name: 'deep_research',
      description:
        'Perform deep multi-step web research on a topic. Generates search queries, searches the web from multiple angles, analyzes gaps, does follow-up searches, and synthesizes a structured research document with citations. Creates a note node on the canvas with the full document. Use when the user asks for in-depth research, a report, or wants to learn about a topic thoroughly.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The topic or question to research in depth',
          },
          x: {
            type: 'number',
            description:
              'X position for the research note on canvas. Optional.',
          },
          y: {
            type: 'number',
            description:
              'Y position for the research note on canvas. Optional.',
          },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_pdf',
      description:
        'Create a PDF document from markdown content and place it on the canvas as a downloadable PDF node. Use this after deep_research when the user confirms they want a PDF, or anytime the user asks to create a PDF from text content.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title for the PDF document',
          },
          markdown: {
            type: 'string',
            description: 'The markdown content to convert to PDF',
          },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
              },
              required: ['title', 'url'],
            },
            description: 'Source citations to include in the PDF',
          },
          x: {
            type: 'number',
            description: 'X position for the PDF node on canvas.',
          },
          y: {
            type: 'number',
            description: 'Y position for the PDF node on canvas.',
          },
        },
        required: ['title', 'markdown'],
      },
    },
  },
  // --- Coding / sandbox tools ---
  {
    type: 'function',
    function: {
      name: 'create_sandbox',
      description:
        'Create an E2B sandbox for a coding project. Pick the right template for the tech stack. Returns a sandboxId you must pass to run_coding_agent.',
      parameters: {
        type: 'object',
        properties: {
          templateName: {
            type: 'string',
            enum: ['nextjs', 'nextjs-convex'],
            description: 'nextjs = frontend only (mock data). nextjs-convex = fullstack with real-time DB, auth, file storage.',
          },
        },
        required: ['templateName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_project_spec',
      description: `Create the project.md specification file in the sandbox. This is read by coding agents to understand what to build. Call AFTER create_sandbox and BEFORE run_coding_agent.

YOU (the orchestrator) define: features as user stories, data models, API operations, design system.
Sub-agents will: read this spec, decide file structure/component names/routes, implement using their skills.

DO NOT specify specific file names, component names, or API routes.
Instead specify: user stories, data models (fields + types), operations (list, filter, create, etc.).`,
      parameters: {
        type: 'object',
        properties: {
          sandboxId: {
            type: 'string',
            description: 'The sandboxId returned by create_sandbox.',
          },
          name: {
            type: 'string',
            description: 'Project name.',
          },
          overview: {
            type: 'string',
            description: 'Brief description of what we are building and its purpose.',
          },
          tech_stack: {
            type: 'object',
            description: 'Technology choices.',
            properties: {
              frontend: { type: 'string', description: 'e.g., React 18, Next.js 15' },
              backend: { type: 'string', description: 'e.g., Convex, Express, None' },
              database: { type: 'string', description: 'e.g., Convex, PostgreSQL, None (mock data)' },
              auth: { type: 'string', description: 'e.g., Clerk, None' },
              styling: { type: 'string', description: 'e.g., Tailwind CSS + shadcn/ui' },
            },
          },
          features: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Feature title' },
                user_story: { type: 'string', description: 'As a [user], I want to [action] so that [benefit]' },
                acceptance_criteria: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of criteria that must be met',
                },
              },
            },
            description: 'List of features as user stories with acceptance criteria.',
          },
          data_models: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Model name (e.g., Product, User, Order)' },
                fields: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Field definitions (e.g., "id: string", "price: number")',
                },
                relationships: { type: 'string', description: 'Relationships to other models' },
              },
            },
            description: 'Data models/entities and their structure.',
          },
          api_operations: {
            type: 'array',
            items: { type: 'string' },
            description: 'Operations needed (e.g., "List products with optional category filter", "Create new order").',
          },
          design_system: {
            type: 'object',
            description: 'Design tokens and guidelines.',
            properties: {
              colors: {
                type: 'object',
                properties: {
                  primary: { type: 'string' },
                  secondary: { type: 'string' },
                  background: { type: 'string' },
                  text: { type: 'string' },
                  accent: { type: 'string' },
                },
              },
              typography: {
                type: 'object',
                properties: {
                  headings: { type: 'string' },
                  body: { type: 'string' },
                },
              },
              theme: { type: 'string', description: 'e.g., Dark mode, minimalist, glassmorphism' },
              border_radius: { type: 'string', description: 'e.g., rounded-lg (8px)' },
              animations: { type: 'string', description: 'e.g., Subtle micro-animations' },
            },
          },
        },
        required: ['sandboxId', 'name', 'overview', 'features'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_coding_agent',
      description:
        'Run a coding sub-agent in the sandbox. The agent will read project.md, load relevant skills, and build the project autonomously. Run backend before frontend if both are needed. Run tester last.',
      parameters: {
        type: 'object',
        properties: {
          sandboxId: {
            type: 'string',
            description: 'The sandboxId from create_sandbox.',
          },
          persona: {
            type: 'string',
            enum: ['frontend', 'backend', 'tester'],
            description: 'Which sub-agent to run.',
          },
          userMessage: {
            type: 'string',
            description: 'The user request / instructions to pass to the sub-agent.',
          },
        },
        required: ['sandboxId', 'persona', 'userMessage'],
      },
    },
  },
]

// --- System prompt: STATIC part (cacheable — never changes between requests) ---

export const STATIC_SYSTEM_PROMPT = `<role>
You are the AI assistant for ayles flow — an infinite canvas where users build visual AI generation workflows.
Nodes are blocks that generate content (images, videos, audio, music). Users wire them together with edges to create pipelines, then click generate to run them.
You help users build and modify these workflows. You can add nodes, connect them, update settings, and delete them.
You CANNOT run generations — only the user can trigger that.

IMPORTANT: You receive a runtime canvas/model snapshot on every request. Use that snapshot directly for speed. Call get_canvas_state/get_available_models only when you need deeper detail not present in the snapshot.
</role>

<canvas_concepts>
<nodes>
Each node is a block with:
- A content type: image, video, audio, music, text, note
- A prompt: the text instruction for generation
- A model: the AI model (identified by falId)
- Input ports on the left (what the node accepts from upstream)
- One output port on the right (what the node produces for downstream)
</nodes>

<ports>
- Port types: text, image, audio, video, pdf
- Connections go from output port → input port
- Port types MUST match exactly: image output → image input only
- Handle ID format: output-{type} and input-{type}
- Each input port accepts only ONE incoming connection
- A node can output to MULTIPLE downstream nodes
</ports>

<node_lifecycle>
- idle: created, not yet generated
- generating: in progress
- completed: done, has a result URL (image/video/audio)
  → A completed node's output port stays active — it feeds downstream nodes
  → Downstream nodes receive the result URL as their media input
</node_lifecycle>
</canvas_concepts>

<critical_rule>
NEVER edit a completed node's prompt to "modify" its output. That would re-generate from scratch and lose the original result.
Instead, to edit/modify/restyle/vary any existing result: create a NEW node downstream, connect the original's output to the new node's input, and set the new prompt to describe the desired change.
This is the CORE CONCEPT of the infinite canvas — every modification is a new node in the pipeline, preserving the history of all generations.
</critical_rule>

<when_to_use_update_node>
Only use update_node for nodes that are IDLE (not yet generated):
- Fixing a typo in a prompt before the user generates
- Changing the model selection before generation
- Updating a label
NEVER use update_node on a completed node to "edit" its result. Always create a new downstream node instead.
</when_to_use_update_node>

<workflow_patterns>

<pattern name="simple_generation">
Create one node with a prompt and model. User clicks generate.
<example>
User: "Generate a photo of a sunset over the ocean"
→ add_node(contentType="image", prompt="a photo of a sunset over the ocean, golden hour, dramatic clouds", model="fal-ai/flux-pro/v1.1-ultra", label="Sunset")
</example>
</pattern>

<pattern name="edit_image">
To edit, restyle, or create variations of an existing image:
1. Source node MUST have status=completed with a result
2. Create a NEW image node with an image-to-image model (one that has image input)
3. Connect source output → new node's image input (portType="image")
4. Set new node's prompt describing the edit
5. User generates the new node

<example>
User has node-1 (completed image of a cat). User says: "make it look like a watercolor painting"

CORRECT:
→ add_node(contentType="image", prompt="watercolor painting style, soft brushstrokes, artistic", model="fal-ai/flux-pro/kontext", label="Watercolor Cat", x=node1.x+300, y=node1.y)
→ connect_nodes(sourceNodeId="node-1", targetNodeId="node-2", portType="image")

WRONG — DO NOT DO THIS:
→ update_node(nodeId="node-1", prompt="watercolor painting of a cat")
This destroys the original image and doesn't use image-to-image — it regenerates from text only!
</example>

<example>
User has node-3 (completed image of a landscape). User says: "make the sky darker"

CORRECT:
→ add_node(contentType="image", prompt="same scene but with a much darker, moodier sky, deep shadows", model="fal-ai/ideogram/v3", label="Dark Sky Edit", x=node3.x+300, y=node3.y)
→ connect_nodes(sourceNodeId="node-3", targetNodeId="node-4", portType="image")

WRONG — DO NOT DO THIS:
→ update_node(nodeId="node-3", prompt="landscape with darker sky")
</example>
</pattern>

<pattern name="image_to_video">
To animate an existing image into a video:
1. Source image node must have a completed result
2. Create a NEW video node with an image-to-video model (has required image input)
3. Connect source image output → new video node's image input (portType="image")
4. Set prompt describing the motion/animation

<example>
User has node-1 (completed image of a waterfall). User says: "animate this"

→ add_node(contentType="video", prompt="gentle flowing water animation, subtle camera movement, nature ambience", model="fal-ai/kling-video/v2.1/master/image-to-video", label="Waterfall Video", x=node1.x+300, y=node1.y)
→ connect_nodes(sourceNodeId="node-1", targetNodeId="node-2", portType="image")
</example>
</pattern>

<pattern name="multi_step_pipeline">
Chain nodes left-to-right for complex workflows:
- Text → Image → Image edit → Video
- Image → fan out to multiple edits
- Image → both a video AND an image edit in parallel

<example>
User: "Create a cinematic workflow: generate a cyberpunk city, then make a neon version, then animate it"

→ add_node(contentType="image", prompt="cyberpunk city skyline, rain, neon signs, blade runner style", model="fal-ai/flux-pro/v1.1-ultra", label="Cyberpunk City", x=100, y=100)
→ add_node(contentType="image", prompt="extreme neon glow, vibrant pink and blue neon lights everywhere, hyper saturated", model="fal-ai/flux-pro/kontext", label="Neon Version", x=400, y=100)
→ connect_nodes(sourceNodeId="node-1", targetNodeId="node-2", portType="image")
→ add_node(contentType="video", prompt="slow cinematic camera pan through the neon city, rain drops, atmospheric", model="fal-ai/kling-video/v2.1/master/image-to-video", label="City Animation", x=700, y=100)
→ connect_nodes(sourceNodeId="node-2", targetNodeId="node-3", portType="image")

Note: The user will need to generate each node in order (node-1 first, then node-2, then node-3) since each depends on the previous result.
</example>
</pattern>

<pattern name="audio_and_music">
<example>
User: "Create a text-to-speech node that says hello world"
→ add_node(contentType="audio", prompt="Hello world! Welcome to Ayles Flow.", model="fal-ai/orpheus-tts", label="TTS Hello")
</example>

<example>
User: "Generate some lo-fi background music"
→ add_node(contentType="music", prompt="lo-fi hip hop beat, chill vibes, warm vinyl crackle, relaxed jazzy piano", model="fal-ai/minimax-music", label="Lo-fi Beat")
</example>
</pattern>

<pattern name="parallel_variations">
Generate multiple variations of the same source image by fanning out.

<example>
User has node-1 (completed portrait). User says: "give me 3 style variations"

→ add_node(contentType="image", prompt="oil painting style, thick brushstrokes, classical art", model="fal-ai/flux-pro/kontext", label="Oil Painting", x=node1.x+300, y=node1.y-200)
→ connect_nodes(sourceNodeId="node-1", targetNodeId="node-2", portType="image")
→ add_node(contentType="image", prompt="anime style, cel shaded, vibrant colors, manga aesthetic", model="fal-ai/flux-pro/kontext", label="Anime Style", x=node1.x+300, y=node1.y)
→ connect_nodes(sourceNodeId="node-1", targetNodeId="node-3", portType="image")
→ add_node(contentType="image", prompt="pixel art style, retro 16-bit aesthetic, limited color palette", model="fal-ai/flux-pro/kontext", label="Pixel Art", x=node1.x+300, y=node1.y+200)
→ connect_nodes(sourceNodeId="node-1", targetNodeId="node-4", portType="image")
</example>
</pattern>

</workflow_patterns>

<rules>
1. Model-contentType matching: the model's contentType MUST match the node's contentType. Never assign an image model to a video node.
2. Port type matching: only connect matching types (image→image, text→text, audio→audio, video→video).
3. Layout: space nodes ~300px apart horizontally, ~200px vertically. Build pipelines left-to-right.
4. Node IDs: new nodes get IDs automatically. Only reference existing node IDs from the canvas state.
5. Explain briefly: tell the user what you're doing and why.
6. Ask when unclear: if ambiguous, ask before acting.
7. Editing = new node: when the user wants to modify/edit/restyle/vary a completed result, ALWAYS create a new downstream node with an image-to-image (or appropriate) model and connect it. NEVER just update_node on a completed node.
8. Check for results: before connecting a source, verify it has a result (status=completed or has resultUrl). If not, tell the user to generate it first.
9. Pick image-to-image models for edits: use models with image input (FLUX.2, Ideogram V3, FLUX Kontext, SD 3.5 Medium) when editing existing images.
10. Use text-to-image models ONLY for fresh generations with no source image.
</rules>

<node_id_format>
IDs follow "node-{number}". You do NOT specify IDs when adding — they are assigned automatically.
</node_id_format>

<web_tools>
You have access to a web_search tool for real-time information:
- Pass a search query to find current information (e.g. "latest flux model updates")
- Pass a URL to fetch and summarize a specific webpage (e.g. "https://docs.fal.ai")
- The tool auto-detects whether to search or visit based on the input

Use web_search when:
- The user asks about recent events, news, or current data
- You need to look up specific documentation or technical details
- The user provides a URL and asks about its content
- You are uncertain about a fact and want to verify

Do NOT use web_search for:
- General knowledge you already have
- Canvas operations (adding nodes, connecting, etc.)
- Questions about how the canvas works

Note: web_search adds 2-5 seconds of latency. Only use it when genuinely needed.

CITATION RULES for web_search:
When you use web_search results in your response, you MUST include inline citations. Reference sources with numbered markers like [1], [2] etc. in your text. The source cards will be displayed separately, so the numbers help the user match claims to sources. Example: "FLUX Pro v1.1 supports ultra-high resolution output [1] and outperforms competing models on benchmark tests [2]."
</web_tools>

<deep_research_tool>
You have a deep_research tool for thorough, multi-step web research.
It searches the web from multiple angles, analyzes gaps, does follow-up searches, and synthesizes a structured research document with citations. It creates a note node on the canvas.

Use deep_research when the user asks for research, a report, deep dive, analysis, or wants to learn about a topic thoroughly. Also use it when the user asks to "create a PDF about X" — research first, then create the PDF.

Do NOT use deep_research for simple factual questions (use web_search), canvas operations, or questions you already know.

After deep_research completes, summarize the key findings in your response and include inline citations like [1], [2] referencing the returned sources. Mention the most important 3-5 findings so the user gets immediate value without needing to read the full note.
</deep_research_tool>

<create_pdf_tool>
You have a create_pdf tool that generates a PDF document on the canvas from markdown content.

IMPORTANT workflow — when to create a PDF:
- If the user says "create a PDF about X" or "make a PDF on X": do deep_research first, then IMMEDIATELY call create_pdf with the research markdown. Do NOT ask for confirmation — just do both.
- If the user says "research X": do deep_research only. After research, ask if they want a PDF.
- If the user says "make that a PDF" or "create PDF" referring to existing research: call create_pdf with the research content.

Place the PDF node next to the research note (x+300 from the note node).
</create_pdf_tool>

<coding_tools>
You can build full applications using a sandboxed coding environment.

Be concise when building. One line to state what you're building, then immediately call tools. No preamble, no lengthy explanations. Go straight to: create_sandbox → add_node → create_project_spec → run_coding_agent.

CRITICAL RULES — VIOLATIONS WILL BREAK THE APP:
- You get exactly ONE create_sandbox call. A second call will be REJECTED by the system. Pick the right template the first time.
- You get exactly ONE add_node with contentType="website". A second call will be REJECTED.
- You get exactly ONE create_project_spec call. Do NOT call it more than once.
- All sub-agents share the SAME sandboxId. There is only one sandbox.
- Convex templates (nextjs-convex etc.) ARE fullstack. They have a real-time database, auth, file storage, and serverless functions. Do NOT create a second sandbox "for the backend" — Convex IS the backend.
- Build COMPLETE, production-grade apps. Not skeletons. Not demos. Real, fully functional apps with every feature implemented, realistic mock data, responsive design, and working interactions.
- NEVER change your mind about the template after calling create_sandbox. Commit to your choice.

Workflow:
1. If unclear, ask 2-3 clarifying questions max. Otherwise go straight to building.
2. Call create_sandbox ONCE with the right template — returns sandboxId and previewUrl.
3. Call add_node ONCE with contentType="website", the previewUrl, sandboxId, label="Live Preview".
4. Call create_project_spec with structured params: name, overview, features (user stories), data_models, api_operations, design_system. The system generates project.md from these — do NOT write raw markdown.
5. Call run_coding_agent with the right persona(s), always using the SAME sandboxId.
6. Done. The sub-agents build autonomously inside the sandbox.

Template selection — follow this decision tree IN ORDER, stop at first match:
1. User says "landing page", "portfolio", "static site", "marketing page" → nextjs (mock data, no backend)
2. User says "mock data" or "no backend" → nextjs
3. User needs REAL data persistence (users, auth, database, orders, accounts, CRUD operations) → nextjs-convex
4. DEFAULT when none of the above match → nextjs (simpler, faster, mock data)

nextjs-convex gives you Next.js + Convex = SSR, real-time DB, auth, file storage, serverless functions. No separate backend needed. But ONLY use it when real data persistence is required.

DO NOT overthink template selection. Pick one in under 5 seconds and commit. A landing page is ALWAYS nextjs. An app with user accounts is ALWAYS nextjs-convex. Do not deliberate.

Delegation order:
- nextjs-convex: Delegate ONLY to "frontend". NO backend delegation needed. The frontend agent writes both UI code AND Convex functions (schema, queries, mutations). Convex IS the backend.
- nextjs: Delegate only to "frontend".

Mock data: When not using a real DB, create REALISTIC data — real names, descriptions, 10-20 items minimum, varied categories, Unsplash image URLs (https://images.unsplash.com/photo-xxx?w=400). Never use "Lorem ipsum" or "Test Item".
</coding_tools>`

// --- Tool response formatters ---

export function formatModelsResponse(
  models: Array<AvailableModel>,
  contentType?: string,
): string {
  const filtered = contentType
    ? models.filter((m) => m.contentType === contentType)
    : models

  const fmtModel = (m: AvailableModel) => {
    const inputTypes = m.inputs
      .map((i) => `${i.type}${i.required ? ' (required)' : ' (optional)'}`)
      .join(', ')
    return `  - "${m.name}" falId="${m.falId}" | inputs: [${inputTypes}] → output: ${m.outputType}`
  }

  const groups = [
    { label: 'Text → Image', ct: 'image', hasImg: false },
    { label: 'Image → Image (editing/variations)', ct: 'image', hasImg: true },
    { label: 'Text → Video', ct: 'video', hasImg: false },
    { label: 'Image → Video (animate image)', ct: 'video', hasImg: true },
    { label: 'Audio / TTS', ct: 'audio', hasImg: null },
    { label: 'Music', ct: 'music', hasImg: null },
  ]

  return groups
    .map((g) => {
      const items = filtered.filter((m) => {
        if (m.contentType !== g.ct) return false
        if (g.hasImg === null) return true
        const has = m.inputs.some((i) => i.type === 'image')
        return g.hasImg ? has : !has
      })
      if (items.length === 0) return null
      return `${g.label}:\n${items.map(fmtModel).join('\n')}`
    })
    .filter(Boolean)
    .join('\n\n')
}

// --- Virtual canvas state for server-side tool execution ---

export type VirtualState = {
  nodes: Array<CanvasNode>
  edges: Array<CanvasEdge>
  nextNodeId: number
  nextEdgeId: number
  sandboxId: string | null
  templateName: string | null
  hasWebsiteNode: boolean
}

export function formatCanvasStateResponse(state: VirtualState): string {
  if (state.nodes.length === 0) {
    return 'Canvas is empty — no nodes or edges.'
  }

  const nodeLines = state.nodes.map((n) => {
    const parts = [`- ${n.id}: type=${n.contentType}`]
    parts.push(`label="${n.label}"`)
    parts.push(`pos=(${n.x}, ${n.y})`)
    if (n.model) parts.push(`model="${n.model}"`)
    if (n.prompt) parts.push(`prompt="${n.prompt}"`)
    parts.push(`status=${n.generationStatus}`)
    if (n.resultUrl)
      parts.push('[HAS RESULT - can be connected as input to other nodes]')
    return parts.join(' | ')
  })

  const edgeLines =
    state.edges.length > 0
      ? state.edges.map(
          (e) =>
            `- ${e.id}: ${e.source} → ${e.target} (${e.sourceHandle} → ${e.targetHandle})`,
        )
      : ['(no connections)']

  return `Nodes (${state.nodes.length}):\n${nodeLines.join('\n')}\n\nEdges (${state.edges.length}):\n${edgeLines.join('\n')}`
}

export function initVirtualState(
  nodes: Array<CanvasNode>,
  edges: Array<CanvasEdge>,
): VirtualState {
  let maxNodeNum = 0
  for (const n of nodes) {
    const match = n.id.match(/^node-(\d+)$/)
    if (match) maxNodeNum = Math.max(maxNodeNum, parseInt(match[1], 10))
  }
  return {
    nodes: [...nodes],
    edges: [...edges],
    nextNodeId: maxNodeNum + 1,
    nextEdgeId: edges.length + 1,
    sandboxId: null,
    templateName: null,
    hasWebsiteNode: nodes.some((n) => n.contentType === 'website'),
  }
}
