import { mutation, query } from './_generated/server'

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()

    if (existing) {
      const updates: Record<string, unknown> = {
        email: identity.email ?? existing.email,
        name: identity.name ?? existing.name,
        imageUrl: identity.pictureUrl ?? existing.imageUrl,
      }
      // Backfill billing fields for existing users
      if (existing.plan === undefined) {
        const now = Date.now()
        updates.plan = 'free'
        updates.credits = 1.0
        updates.creditsLimit = 1.0
        updates.currentPeriodStart = now
        updates.currentPeriodEnd = now + 30 * 24 * 60 * 60 * 1000
      }
      await ctx.db.patch(existing._id, updates)
      return existing._id
    }

    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkId: identity.subject,
      email: identity.email ?? '',
      name: identity.name,
      imageUrl: identity.pictureUrl,
      plan: 'free',
      credits: 1.0,
      creditsLimit: 1.0,
      currentPeriodStart: now,
      currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
    })
  },
})

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }

    return await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
  },
})
