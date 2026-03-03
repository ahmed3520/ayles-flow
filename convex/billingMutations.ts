import { v } from 'convex/values'

import { internalMutation } from './_generated/server'

const PLAN_CREDITS = {
  free: 10,
  pro: 500,
} as const

export const activateSubscription = internalMutation({
  args: {
    clerkId: v.string(),
    polarCustomerId: v.string(),
    subscriptionId: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique()
    if (!user) throw new Error('User not found for clerkId')

    const credits = PLAN_CREDITS.pro

    await ctx.db.patch(user._id, {
      polarCustomerId: args.polarCustomerId,
      plan: 'pro',
      subscriptionId: args.subscriptionId,
      subscriptionStatus: 'active',
      credits,
      creditsLimit: credits,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
    })

    await ctx.db.insert('creditTransactions', {
      userId: user._id,
      type: 'reset',
      amount: credits,
      balance: credits,
      description: 'Pro subscription activated',
      createdAt: Date.now(),
    })
  },
})

export const renewSubscription = internalMutation({
  args: {
    clerkId: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique()
    if (!user) return

    // Idempotency: skip if period hasn't changed
    if (user.currentPeriodStart === args.currentPeriodStart) return

    const plan = (user.plan ?? 'free') as keyof typeof PLAN_CREDITS
    const credits = PLAN_CREDITS[plan]

    await ctx.db.patch(user._id, {
      credits,
      creditsLimit: credits,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
    })

    await ctx.db.insert('creditTransactions', {
      userId: user._id,
      type: 'reset',
      amount: credits,
      balance: credits,
      description: `Monthly credit reset (${plan} plan)`,
      createdAt: Date.now(),
    })
  },
})

export const updateSubscriptionStatus = internalMutation({
  args: {
    clerkId: v.string(),
    subscriptionId: v.string(),
    status: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique()
    if (!user) return

    await ctx.db.patch(user._id, {
      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
    })
  },
})

export const cancelSubscription = internalMutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique()
    if (!user) return

    const credits = PLAN_CREDITS.free

    await ctx.db.patch(user._id, {
      plan: 'free',
      subscriptionId: undefined,
      subscriptionStatus: undefined,
      credits,
      creditsLimit: credits,
    })

    await ctx.db.insert('creditTransactions', {
      userId: user._id,
      type: 'reset',
      amount: credits,
      balance: credits,
      description: 'Downgraded to Free plan',
      createdAt: Date.now(),
    })
  },
})

export const resetFreeCredits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const users = await ctx.db.query('users').collect()

    for (const user of users) {
      const plan = user.plan ?? 'free'
      if (plan !== 'free') continue

      const periodEnd = user.currentPeriodEnd ?? 0
      if (periodEnd > 0 && periodEnd <= now) {
        const credits = PLAN_CREDITS.free
        await ctx.db.patch(user._id, {
          credits,
          creditsLimit: credits,
          currentPeriodStart: now,
          currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
        })

        await ctx.db.insert('creditTransactions', {
          userId: user._id,
          type: 'reset',
          amount: credits,
          balance: credits,
          description: 'Monthly credit reset (free plan)',
          createdAt: now,
        })
      }
    }
  },
})
