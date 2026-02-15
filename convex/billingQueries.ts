import { v } from 'convex/values'

import { internalQuery, query } from './_generated/server'

export const getUserByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique()
  },
})

export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
    if (!user) return null

    return {
      plan: user.plan ?? 'free',
      credits: user.credits ?? 1.0,
      creditsLimit: user.creditsLimit ?? 1.0,
      subscriptionStatus: user.subscriptionStatus ?? null,
      currentPeriodEnd: user.currentPeriodEnd ?? null,
      polarCustomerId: user.polarCustomerId ?? null,
    }
  },
})

export const getCreditTransactions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
    if (!user) return []

    return await ctx.db
      .query('creditTransactions')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(args.limit ?? 50)
  },
})
