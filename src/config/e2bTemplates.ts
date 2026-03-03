import type { TemplateConfig } from '@/types/coding-agent'

const WORKDIR = '/home/user/app'

export const E2B_TEMPLATES: Record<string, TemplateConfig> = {
  // Frontend
  vite: {
    id: 'm8vig10ovz8jgg537fnv',
    name: 'vite',
    category: 'frontend',
    defaultPort: 5173,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
  },
  nextjs: {
    id: 'xv0k19z2x5c9f3bdcxne',
    name: 'nextjs',
    category: 'frontend',
    defaultPort: 3000,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
  },
  tanstack: {
    id: '9eti2k16gu447z6niboe',
    name: 'tanstack',
    category: 'frontend',
    defaultPort: 3000,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
  },
  remix: {
    id: '0qc9mmcdzv72j7le6zxx',
    name: 'remix',
    category: 'frontend',
    defaultPort: 3000,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
  },
  nuxt: {
    id: 'adan0j7m2wiys5bcescn',
    name: 'nuxt',
    category: 'frontend',
    defaultPort: 3000,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
  },
  svelte: {
    id: 'o1uiv4z3y42fq7o4kgki',
    name: 'svelte',
    category: 'frontend',
    defaultPort: 5173,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
  },
  astro: {
    id: 'jz2g3oydkbr6fkc2l0f4',
    name: 'astro',
    category: 'frontend',
    defaultPort: 4321,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
  },

  // Backend
  express: {
    id: 'z82fjfi5c5u37mvlm0df',
    name: 'express',
    category: 'backend',
    defaultPort: 8000,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
  },
  hono: {
    id: '83z6t8qcrob72vxxicoy',
    name: 'hono',
    category: 'backend',
    defaultPort: 8000,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
  },
  fastapi: {
    id: 'w2dtz08ktz3lxti8mcv4',
    name: 'fastapi',
    category: 'backend',
    defaultPort: 8000,
    workdir: WORKDIR,
    devCmd: 'uvicorn app.main:app --reload --port 8000',
  },
  flask: {
    id: 'ukdjmznq5llj5be0cvsr',
    name: 'flask',
    category: 'backend',
    defaultPort: 5000,
    workdir: WORKDIR,
    devCmd: 'flask run --port 5000',
  },
  django: {
    id: 'jrj5htsdsbvftekwlsmd',
    name: 'django',
    category: 'backend',
    defaultPort: 8000,
    workdir: WORKDIR,
    devCmd: 'python manage.py runserver 0.0.0.0:8000',
  },

  // Fullstack
  'vite-express': {
    id: 'neeaylgppfgdv66n0s91',
    name: 'vite-express',
    category: 'fullstack',
    defaultPort: 3000,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
  },
  'nextjs-express': {
    id: 'w6cvahvxf7agvh9phy4c',
    name: 'nextjs-express',
    category: 'fullstack',
    defaultPort: 3000,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
  },
  'vite-convex': {
    id: 'x7gyhpnw8s4h770d42g0',
    name: 'vite-convex',
    category: 'fullstack',
    defaultPort: 5173,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
    convex: true,
  },
  'nextjs-convex': {
    id: 'uzto48tvduo78atpgv7a',
    name: 'nextjs-convex',
    category: 'fullstack',
    defaultPort: 3000,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
    convex: true,
  },
  'tanstack-convex': {
    id: 'fbu6a0x5itig1hqgf7ka',
    name: 'tanstack-convex',
    category: 'fullstack',
    defaultPort: 3000,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
    convex: true,
  },

  // Base
  'node-base': {
    id: '7lajixmr5x56htr95xoh',
    name: 'node-base',
    category: 'base',
    defaultPort: 3000,
    workdir: WORKDIR,
    devCmd: 'npm run dev',
  },
  'python-base': {
    id: 'a1330lez5rmb5ap1r5a0',
    name: 'python-base',
    category: 'base',
    defaultPort: 8000,
    workdir: WORKDIR,
    devCmd: 'python main.py',
  },
  desktop: {
    id: 'k0wmnzir0zuzye6dndlw',
    name: 'desktop',
    category: 'base',
    defaultPort: 6080,
    workdir: '/home/user',
    devCmd: '',
  },
  'code-interpreter': {
    id: 'nlhz8vlwyupq845jsdg9',
    name: 'code-interpreter',
    category: 'base',
    defaultPort: 8888,
    workdir: '/home/user',
    devCmd: '',
  },
}

export function getTemplate(name: string): TemplateConfig | undefined {
  return E2B_TEMPLATES[name]
}

export function getTemplateById(id: string): TemplateConfig | undefined {
  return Object.values(E2B_TEMPLATES).find((t) => t.id === id)
}

export function isConvexTemplate(name: string): boolean {
  return E2B_TEMPLATES[name]?.convex === true
}

export function listTemplates(
  category?: TemplateConfig['category'],
): TemplateConfig[] {
  const all = Object.values(E2B_TEMPLATES)
  return category ? all.filter((t) => t.category === category) : all
}
