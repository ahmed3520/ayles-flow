import { mutation } from './_generated/server'

/**
 * Migration: Convert old projectId-based chatMessages to chatId-based.
 *
 * For each unique projectId in chatMessages that has no chatId:
 * 1. Creates a `chats` record for that project
 * 2. Patches all its messages to reference the new chatId
 * 3. Removes the old projectId field
 *
 * Run once via dashboard: `migrateChatMessages:run`
 * After verifying, tighten the schema back (make chatId required, remove projectId).
 */
export const run = mutation({
  args: {},
  handler: async (ctx) => {
    const allMessages = await ctx.db.query('chatMessages').collect()

    // Find messages that have projectId but no chatId (old format)
    const oldMessages = allMessages.filter(
      (m) =>
        (m as Record<string, unknown>).projectId &&
        !(m as Record<string, unknown>).chatId,
    )

    if (oldMessages.length === 0) {
      return { migrated: 0, chatsCreated: 0 }
    }

    // Group by projectId
    const byProject = new Map<string, typeof oldMessages>()
    for (const msg of oldMessages) {
      const pid = (msg as Record<string, unknown>).projectId as string
      if (!byProject.has(pid)) byProject.set(pid, [])
      byProject.get(pid)!.push(msg)
    }

    let chatsCreated = 0
    let migrated = 0

    for (const [projectId, messages] of byProject) {
      // Sort by createdAt to get the first message for title
      messages.sort((a, b) => a.createdAt - b.createdAt)
      const firstUserMsg = messages.find((m) => m.role === 'user')
      const title = firstUserMsg
        ? firstUserMsg.content.length > 50
          ? firstUserMsg.content.slice(0, 47) + '...'
          : firstUserMsg.content
        : 'Imported chat'

      const now = Date.now()
      const chatId = await ctx.db.insert('chats', {
        projectId: projectId as any,
        title,
        createdAt: messages[0].createdAt,
        updatedAt: messages[messages.length - 1].createdAt,
      })
      chatsCreated++

      for (const msg of messages) {
        await ctx.db.patch(msg._id, {
          chatId,
          projectId: undefined,
        } as any)
        migrated++
      }
    }

    return { migrated, chatsCreated }
  },
})
