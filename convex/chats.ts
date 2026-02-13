import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

export const list = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    return await ctx.db
      .query('chats')
      .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .collect()
  },
})

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const now = Date.now()
    return await ctx.db.insert('chats', {
      projectId: args.projectId,
      title: args.title ?? 'New chat',
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const updateTitle = mutation({
  args: {
    chatId: v.id('chats'),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    await ctx.db.patch(args.chatId, {
      title: args.title,
      updatedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { chatId: v.id('chats') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    // Delete all messages in this chat
    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('by_chatId', (q) => q.eq('chatId', args.chatId))
      .collect()

    for (const msg of messages) {
      await ctx.db.delete(msg._id)
    }

    await ctx.db.delete(args.chatId)
  },
})
