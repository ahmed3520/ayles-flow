import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

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
