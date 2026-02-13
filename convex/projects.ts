import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()

    if (!user) {
      return []
    }

    const projects = await ctx.db
      .query('projects')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect()

    return await Promise.all(
      projects.map(async (project) => ({
        ...project,
        thumbnailUrl: project.thumbnailStorageId
          ? await ctx.storage.getUrl(project.thumbnailStorageId)
          : null,
      })),
    )
  },
})

export const get = query({
  args: { id: v.id('projects') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    const project = await ctx.db.get(args.id)
    if (!project) {
      return null
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()

    if (!user || project.userId !== user._id) {
      return null
    }

    return project
  },
})

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()

    if (!user) {
      throw new Error('User not found')
    }

    return await ctx.db.insert('projects', {
      userId: user._id,
      name: args.name,
      nodes: [],
      edges: [],
      updatedAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('projects'),
    name: v.optional(v.string()),
    nodes: v.optional(v.array(v.any())),
    edges: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const project = await ctx.db.get(args.id)
    if (!project) {
      throw new Error('Project not found')
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()

    if (!user || project.userId !== user._id) {
      throw new Error('Not authorized')
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.nodes !== undefined) updates.nodes = args.nodes
    if (args.edges !== undefined) updates.edges = args.edges

    await ctx.db.patch(args.id, updates)
    return args.id
  },
})

export const saveThumbnail = mutation({
  args: {
    id: v.id('projects'),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const project = await ctx.db.get(args.id)
    if (!project) {
      throw new Error('Project not found')
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()

    if (!user || project.userId !== user._id) {
      throw new Error('Not authorized')
    }

    // Delete old thumbnail from storage if it exists
    if (project.thumbnailStorageId) {
      await ctx.storage.delete(project.thumbnailStorageId)
    }

    await ctx.db.patch(args.id, { thumbnailStorageId: args.storageId })
  },
})

export const remove = mutation({
  args: { id: v.id('projects') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const project = await ctx.db.get(args.id)
    if (!project) {
      throw new Error('Project not found')
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()

    if (!user || project.userId !== user._id) {
      throw new Error('Not authorized')
    }

    await ctx.db.delete(args.id)
  },
})
