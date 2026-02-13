import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

/**
 * Generate upload URL for client-side file upload
 */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Save upload metadata after successful upload
 */
export const saveUpload = mutation({
  args: {
    storageId: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    contentCategory: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()

    if (!user) throw new Error('User not found')

    const uploadId = await ctx.db.insert('uploads', {
      userId: user._id,
      ...args,
      uploadedAt: Date.now(),
    })

    // Get storage URL to return with the upload ID
    const url = await ctx.storage.getUrl(args.storageId)

    return { uploadId, url: url || '' }
  },
})

/**
 * Get upload details by ID
 */
export const getUpload = query({
  args: { id: v.id('uploads') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

/**
 * Get storage URL for uploaded file
 */
export const getUploadUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

/**
 * List user uploads with optional category filter
 */
export const listUploads = query({
  args: {
    contentCategory: v.optional(v.string()),
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

    let query

    if (args.contentCategory) {
      const category = args.contentCategory // TypeScript narrowing
      query = ctx.db
        .query('uploads')
        .withIndex('by_contentCategory', (q) =>
          q.eq('contentCategory', category),
        )
        .filter((q) => q.eq(q.field('userId'), user._id))
        .order('desc')
    } else {
      query = ctx.db
        .query('uploads')
        .withIndex('by_userId', (q) => q.eq('userId', user._id))
        .order('desc')
    }

    const uploads = await query.take(args.limit ?? 50)

    // Get URLs for all uploads
    return await Promise.all(
      uploads.map(async (upload) => ({
        ...upload,
        url: await ctx.storage.getUrl(upload.storageId),
      })),
    )
  },
})

/**
 * Delete upload from storage and database
 */
export const deleteUpload = mutation({
  args: { id: v.id('uploads') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const upload = await ctx.db.get(args.id)
    if (!upload) throw new Error('Upload not found')

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()

    if (!user || upload.userId !== user._id) {
      throw new Error('Not authorized')
    }

    // Delete from storage
    await ctx.storage.delete(upload.storageId)

    // Delete from database
    await ctx.db.delete(args.id)
  },
})
