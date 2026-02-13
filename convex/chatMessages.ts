import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

export const list = query({
  args: { chatId: v.id('chats') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    return await ctx.db
      .query('chatMessages')
      .withIndex('by_chatId', (q) => q.eq('chatId', args.chatId))
      .order('asc')
      .collect()
  },
})

export const send = mutation({
  args: {
    chatId: v.id('chats'),
    role: v.string(),
    content: v.string(),
    actions: v.optional(v.array(v.any())),
    parts: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    // Update the parent chat's updatedAt timestamp
    await ctx.db.patch(args.chatId, { updatedAt: Date.now() })

    return await ctx.db.insert('chatMessages', {
      chatId: args.chatId,
      role: args.role,
      content: args.content,
      actions: args.actions,
      parts: args.parts,
      createdAt: Date.now(),
    })
  },
})

export const clear = mutation({
  args: { chatId: v.id('chats') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('by_chatId', (q) => q.eq('chatId', args.chatId))
      .collect()

    for (const msg of messages) {
      await ctx.db.delete(msg._id)
    }
  },
})
