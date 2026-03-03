import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    provider: v.string(),
    deploymentId: v.string(),
    url: v.string(),
    status: v.string(),
    templateName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
    if (!user) throw new Error('User not found')

    const id = await ctx.db.insert('deployments', {
      ...args,
      userId: user._id,
      createdAt: Date.now(),
    })

    // Update project with latest deploy URL
    await ctx.db.patch(args.projectId, { lastDeployUrl: args.url })

    return id
  },
})

export const updateStatus = mutation({
  args: {
    deploymentId: v.string(),
    status: v.string(),
    url: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    // Find deployment by deploymentId (provider ID)
    const deployments = await ctx.db.query('deployments').collect()
    const deployment = deployments.find((d) => d.deploymentId === args.deploymentId)
    if (!deployment) throw new Error('Deployment not found')

    const patch: Record<string, unknown> = { status: args.status }
    if (args.url) patch.url = args.url
    if (args.error) patch.error = args.error
    if (args.status === 'ready') patch.readyAt = Date.now()

    await ctx.db.patch(deployment._id, patch)

    // Update project deploy URL if ready
    if (args.status === 'ready' && args.url) {
      await ctx.db.patch(deployment.projectId, { lastDeployUrl: args.url })
    }
  },
})

export const getByProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    return ctx.db
      .query('deployments')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .collect()
  },
})

export const getLatest = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    return ctx.db
      .query('deployments')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .first()
  },
})
