import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  products: defineTable({
    title: v.string(),
    imageId: v.string(),
    price: v.number(),
  }),
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // Billing
    stripeCustomerId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    plan: v.optional(v.string()),
    credits: v.optional(v.number()),
    creditsLimit: v.optional(v.number()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
  })
    .index('by_clerkId', ['clerkId'])
    .index('by_stripeCustomerId', ['stripeCustomerId']),
  projects: defineTable({
    userId: v.id('users'),
    name: v.string(),
    nodes: v.array(v.any()),
    edges: v.array(v.any()),
    thumbnailStorageId: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),
  versions: defineTable({
    projectId: v.id('projects'),
    name: v.string(),
    nodes: v.array(v.any()),
    edges: v.array(v.any()),
    createdAt: v.number(),
  }).index('by_projectId', ['projectId']),
  models: defineTable({
    falId: v.string(),
    name: v.string(),
    provider: v.string(),
    contentType: v.string(),
    creditCost: v.number(),
    pricingUnit: v.string(),
    isActive: v.boolean(),
    inputs: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        required: v.boolean(),
        falParam: v.string(),
      }),
    ),
    outputType: v.string(),
  })
    .index('by_contentType', ['contentType'])
    .index('by_falId', ['falId']),
  generations: defineTable({
    userId: v.id('users'),
    contentType: v.string(),
    modelId: v.string(),
    prompt: v.string(),
    status: v.string(),
    falRequestId: v.optional(v.string()),
    resultUrl: v.optional(v.string()),
    resultMeta: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_falRequestId', ['falRequestId'])
    .index('by_userId', ['userId']),
  chats: defineTable({
    projectId: v.id('projects'),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_projectId', ['projectId']),
  chatMessages: defineTable({
    chatId: v.optional(v.id('chats')),
    projectId: v.optional(v.id('projects')),
    role: v.string(),
    content: v.string(),
    actions: v.optional(v.array(v.any())),
    parts: v.optional(v.array(v.any())),
    createdAt: v.number(),
  })
    .index('by_chatId', ['chatId'])
    .index('by_projectId', ['projectId']),
  uploads: defineTable({
    userId: v.id('users'),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    storageId: v.string(),
    contentCategory: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    duration: v.optional(v.number()),
    uploadedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_contentCategory', ['contentCategory']),
  creditTransactions: defineTable({
    userId: v.id('users'),
    type: v.string(),
    amount: v.number(),
    balance: v.number(),
    description: v.string(),
    generationId: v.optional(v.id('generations')),
    createdAt: v.number(),
  }).index('by_userId', ['userId']),
})
