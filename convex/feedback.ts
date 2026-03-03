import { v } from 'convex/values'

import { mutation } from './_generated/server'

export const submit = mutation({
  args: {
    email: v.optional(v.string()),
    type: v.union(v.literal('bug'), v.literal('feedback'), v.literal('feature')),
    message: v.string(),
    page: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('feedback', {
      email: args.email,
      type: args.type,
      message: args.message,
      page: args.page,
      createdAt: Date.now(),
    })
  },
})
