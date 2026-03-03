import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

/**
 * Test helpers — used by integration tests only.
 * These mutations bypass auth so the test runner can set up data directly.
 */

export const createTestGeneration = mutation({
  args: {
    contentType: v.string(),
    modelId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query('users').first()
    if (!user) throw new Error('No users in DB — sign in to the app first')

    return await ctx.db.insert('generations', {
      userId: user._id,
      contentType: args.contentType,
      modelId: args.modelId,
      prompt: args.prompt,
      status: 'submitted',
      createdAt: Date.now(),
    })
  },
})

export const deleteTestGeneration = mutation({
  args: { id: v.id('generations') },
  handler: async (ctx, args) => {
    const gen = await ctx.db.get(args.id)
    if (gen) await ctx.db.delete(args.id)
  },
})

// ── Credit testing helpers ──────────────────────────────────────────────────

export const getTestUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query('users').first()
    if (!user) return null
    return {
      _id: user._id,
      credits: user.credits ?? 0,
      creditsLimit: user.creditsLimit ?? 0,
      plan: user.plan ?? 'free',
    }
  },
})

export const setTestUserCredits = mutation({
  args: { credits: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query('users').first()
    if (!user) throw new Error('No users in DB')
    await ctx.db.patch(user._id, { credits: args.credits })
  },
})

export const getTestGeneration = query({
  args: { id: v.id('generations') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const getRecentCreditTransactions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await ctx.db.query('users').first()
    if (!user) return []
    return await ctx.db
      .query('creditTransactions')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(args.limit ?? 5)
  },
})

export const completeTestTextGeneration = mutation({
  args: {
    generationId: v.id('generations'),
    resultText: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId)
    if (!generation) throw new Error('Generation not found')

    const model = await ctx.db
      .query('models')
      .withIndex('by_falId', (q) => q.eq('falId', generation.modelId))
      .unique()

    let tokenCreditCost = 0
    if (model) {
      const inputCost =
        (args.inputTokens / 1_000_000) * (model.inputTokenCost ?? 0)
      const outputCost =
        (args.outputTokens / 1_000_000) * (model.outputTokenCost ?? 0)
      tokenCreditCost = Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
    }

    const user = await ctx.db.get(generation.userId)
    if (user && tokenCreditCost > 0) {
      const currentCredits = user.credits ?? 0
      const newBalance = currentCredits - tokenCreditCost
      await ctx.db.patch(user._id, { credits: newBalance })

      await ctx.db.insert('creditTransactions', {
        userId: user._id,
        type: 'deduction',
        amount: -tokenCreditCost,
        balance: newBalance,
        description: `${model?.name ?? 'Text'} generation (${args.inputTokens}in + ${args.outputTokens}out tokens)`,
        generationId: generation._id,
        createdAt: Date.now(),
      })
    }

    await ctx.db.patch(generation._id, {
      status: 'completed',
      resultText: args.resultText,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      tokenCreditCost,
      completedAt: Date.now(),
    })

    return { tokenCreditCost }
  },
})
