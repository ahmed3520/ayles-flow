import { v } from 'convex/values'

import { mutation } from './_generated/server'

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
