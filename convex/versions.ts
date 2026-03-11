import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

const TEXT_VERSION_PREFIX = '[text:'

function getTextVersionPrefix(nodeId: string): string {
  return `${TEXT_VERSION_PREFIX}${nodeId}] `
}

function toPlainText(document: string): string {
  return document
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|blockquote|li)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTextDocumentFromNodes(
  nodes: Array<any>,
  nodeId: string,
): string | null {
  const targetNode = nodes.find(
    (node) =>
      node &&
      typeof node === 'object' &&
      node.id === nodeId &&
      node.data?.contentType === 'text',
  )
  if (!targetNode) return null

  const resultText =
    typeof targetNode.data?.resultText === 'string'
      ? targetNode.data.resultText
      : null
  const prompt =
    typeof targetNode.data?.prompt === 'string' ? targetNode.data.prompt : ''
  return resultText ?? prompt
}

function hasDocumentContent(document: string): boolean {
  if (!document.trim()) return false
  return toPlainText(document).trim().length > 0
}

export const list = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
    if (!user) return []

    const project = await ctx.db.get(args.projectId)
    if (!project || project.userId !== user._id) return []

    return await ctx.db
      .query('versions')
      .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .collect()
  },
})

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
    if (!user) throw new Error('User not found')

    const project = await ctx.db.get(args.projectId)
    if (!project || project.userId !== user._id) {
      throw new Error('Not authorized')
    }

    return await ctx.db.insert('versions', {
      projectId: args.projectId,
      name: args.name,
      nodes: project.nodes,
      edges: project.edges,
      createdAt: Date.now(),
    })
  },
})

export const listTextNodeVersions = query({
  args: {
    projectId: v.id('projects'),
    nodeId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
    if (!user) return []

    const project = await ctx.db.get(args.projectId)
    if (!project || project.userId !== user._id) return []

    const prefix = getTextVersionPrefix(args.nodeId)
    const versions = await ctx.db
      .query('versions')
      .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .collect()

    return versions.flatMap((version) => {
      if (!version.name.startsWith(prefix)) return []

      const document = getTextDocumentFromNodes(version.nodes, args.nodeId)
      if (document == null) return []

      return [
        {
          _id: version._id,
          createdAt: version.createdAt,
          name: version.name.slice(prefix.length) || 'Snapshot',
          previewText: toPlainText(document).slice(0, 180),
          document,
        },
      ]
    })
  },
})

export const restore = mutation({
  args: {
    projectId: v.id('projects'),
    versionId: v.id('versions'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
    if (!user) throw new Error('User not found')

    const project = await ctx.db.get(args.projectId)
    if (!project || project.userId !== user._id) {
      throw new Error('Not authorized')
    }

    const version = await ctx.db.get(args.versionId)
    if (!version || version.projectId !== args.projectId) {
      throw new Error('Version not found')
    }

    await ctx.db.patch(args.projectId, {
      nodes: version.nodes,
      edges: version.edges,
      updatedAt: Date.now(),
    })
  },
})

export const createTextNodeVersion = mutation({
  args: {
    projectId: v.id('projects'),
    nodeId: v.string(),
    name: v.string(),
    document: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
    if (!user) throw new Error('User not found')

    const project = await ctx.db.get(args.projectId)
    if (!project || project.userId !== user._id) {
      throw new Error('Not authorized')
    }

    const now = Date.now()
    const hasContent = hasDocumentContent(args.document)
    const targetNodeIndex = project.nodes.findIndex(
      (node) =>
        node &&
        typeof node === 'object' &&
        node.id === args.nodeId &&
        node.data?.contentType === 'text',
    )
    if (targetNodeIndex < 0) {
      throw new Error('Text node not found')
    }

    const nextNodes = project.nodes.map((node, index) => {
      if (
        !node ||
        typeof node !== 'object' ||
        index !== targetNodeIndex
      ) {
        return node
      }

      return {
        ...node,
        data: {
          ...node.data,
          generationStatus: hasContent ? 'completed' : 'idle',
          generationId: undefined,
          resultText: hasContent ? args.document : undefined,
          errorMessage: undefined,
        },
      }
    })

    await ctx.db.patch(args.projectId, {
      nodes: nextNodes,
      updatedAt: now,
    })

    const storageName = `${getTextVersionPrefix(args.nodeId)}${args.name.trim() || 'Snapshot'}`
    return await ctx.db.insert('versions', {
      projectId: args.projectId,
      name: storageName,
      nodes: nextNodes,
      edges: project.edges,
      createdAt: now,
    })
  },
})

export const restoreTextNodeVersion = mutation({
  args: {
    projectId: v.id('projects'),
    versionId: v.id('versions'),
    nodeId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
    if (!user) throw new Error('User not found')

    const project = await ctx.db.get(args.projectId)
    if (!project || project.userId !== user._id) {
      throw new Error('Not authorized')
    }

    const version = await ctx.db.get(args.versionId)
    if (!version || version.projectId !== args.projectId) {
      throw new Error('Version not found')
    }

    const document = getTextDocumentFromNodes(version.nodes, args.nodeId)
    if (document == null) {
      throw new Error('Text content not found in version')
    }

    const hasContent = hasDocumentContent(document)
    const targetNodeIndex = project.nodes.findIndex(
      (node) =>
        node &&
        typeof node === 'object' &&
        node.id === args.nodeId &&
        node.data?.contentType === 'text',
    )
    if (targetNodeIndex < 0) {
      throw new Error('Text node not found')
    }

    const nextNodes = project.nodes.map((node, index) => {
      if (
        !node ||
        typeof node !== 'object' ||
        index !== targetNodeIndex
      ) {
        return node
      }

      return {
        ...node,
        data: {
          ...node.data,
          generationStatus: hasContent ? 'completed' : 'idle',
          generationId: undefined,
          resultText: hasContent ? document : undefined,
          errorMessage: undefined,
        },
      }
    })

    await ctx.db.patch(args.projectId, {
      nodes: nextNodes,
      updatedAt: Date.now(),
    })

    return { document }
  },
})

export const remove = mutation({
  args: { id: v.id('versions') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
    if (!user) throw new Error('User not found')

    const version = await ctx.db.get(args.id)
    if (!version) throw new Error('Version not found')

    const project = await ctx.db.get(version.projectId)
    if (!project || project.userId !== user._id) {
      throw new Error('Not authorized')
    }

    await ctx.db.delete(args.id)
  },
})
