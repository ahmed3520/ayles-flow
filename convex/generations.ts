import { v } from 'convex/values'

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'

export const create = mutation({
  args: {
    contentType: v.string(),
    modelId: v.string(),
    prompt: v.string(),
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

    // Look up model to get pricing
    const model = await ctx.db
      .query('models')
      .withIndex('by_falId', (q) => q.eq('falId', args.modelId))
      .unique()
    if (!model) throw new Error('Model not found')

    const currentCredits = user.credits ?? 0
    const isTokenPriced =
      (model.inputTokenCost ?? 0) > 0 || (model.outputTokenCost ?? 0) > 0

    if (isTokenPriced) {
      // Token-priced models (text/LLM via OpenRouter):
      // Don't deduct upfront — actual cost depends on token usage.
      // Just verify the user has credits remaining.
      if (currentCredits <= 0) {
        throw new Error(
          `Insufficient credits. Have ${currentCredits.toFixed(3)}`,
        )
      }

      return await ctx.db.insert('generations', {
        userId: user._id,
        contentType: args.contentType,
        modelId: args.modelId,
        prompt: args.prompt,
        status: 'submitted',
        createdAt: Date.now(),
      })
    }

    // Flat-rate models (FAL): deduct credits upfront
    if (currentCredits < model.creditCost) {
      throw new Error(
        `Insufficient credits. Need ${model.creditCost}, have ${currentCredits.toFixed(3)}`,
      )
    }

    const newBalance = currentCredits - model.creditCost
    await ctx.db.patch(user._id, { credits: newBalance })

    const generationId = await ctx.db.insert('generations', {
      userId: user._id,
      contentType: args.contentType,
      modelId: args.modelId,
      prompt: args.prompt,
      status: 'submitted',
      createdAt: Date.now(),
    })

    await ctx.db.insert('creditTransactions', {
      userId: user._id,
      type: 'deduction',
      amount: -model.creditCost,
      balance: newBalance,
      description: `${model.name} generation`,
      generationId,
      createdAt: Date.now(),
    })

    return generationId
  },
})

export const setFalRequestId = mutation({
  args: {
    id: v.id('generations'),
    falRequestId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      falRequestId: args.falRequestId,
      status: 'processing',
    })
  },
})

export const get = query({
  args: { id: v.id('generations') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const getByFalRequestId = internalQuery({
  args: { falRequestId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('generations')
      .withIndex('by_falRequestId', (q) =>
        q.eq('falRequestId', args.falRequestId),
      )
      .unique()
  },
})

export const completeGeneration = internalMutation({
  args: {
    falRequestId: v.string(),
    resultUrl: v.string(),
    resultMeta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db
      .query('generations')
      .withIndex('by_falRequestId', (q) =>
        q.eq('falRequestId', args.falRequestId),
      )
      .unique()

    if (!generation) {
      console.error(
        `No generation found for falRequestId: ${args.falRequestId}`,
      )
      return
    }

    await ctx.db.patch(generation._id, {
      status: 'completed',
      resultUrl: args.resultUrl,
      resultMeta: args.resultMeta,
      completedAt: Date.now(),
    })
  },
})

export const completeTextGeneration = mutation({
  args: {
    generationId: v.id('generations'),
    resultText: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const generation = await ctx.db.get(args.generationId)
    if (!generation) throw new Error('Generation not found')

    // Look up model for token pricing
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

    // Deduct credits based on actual token usage
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
  },
})

export const failGeneration = internalMutation({
  args: {
    falRequestId: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db
      .query('generations')
      .withIndex('by_falRequestId', (q) =>
        q.eq('falRequestId', args.falRequestId),
      )
      .unique()

    if (!generation) {
      console.error(
        `No generation found for falRequestId: ${args.falRequestId}`,
      )
      return
    }

    await ctx.db.patch(generation._id, {
      status: 'error',
      errorMessage: args.errorMessage,
      completedAt: Date.now(),
    })

    // Refund credits for failed generation
    const model = await ctx.db
      .query('models')
      .withIndex('by_falId', (q) => q.eq('falId', generation.modelId))
      .unique()

    if (model) {
      const user = await ctx.db.get(generation.userId)
      if (user) {
        const currentCredits = user.credits ?? 0
        const newBalance = currentCredits + model.creditCost
        await ctx.db.patch(user._id, { credits: newBalance })

        await ctx.db.insert('creditTransactions', {
          userId: user._id,
          type: 'refund',
          amount: model.creditCost,
          balance: newBalance,
          description: `Refund: ${model.name} generation failed`,
          generationId: generation._id,
          createdAt: Date.now(),
        })
      }
    }
  },
})
