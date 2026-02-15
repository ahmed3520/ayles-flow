'use node'

import { Polar } from '@polar-sh/sdk'
import {
  validateEvent,
  WebhookVerificationError,
} from '@polar-sh/sdk/webhooks'
import { v } from 'convex/values'

import { internal } from './_generated/api'
import { action, internalAction } from './_generated/server'

function getPolar() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN
  if (!accessToken) throw new Error('POLAR_ACCESS_TOKEN not configured')
  return new Polar({
    accessToken,
    server:
      (process.env.POLAR_SERVER as 'sandbox' | 'production') ?? 'sandbox',
  })
}

export const createCheckoutSession = action({
  args: {
    returnUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string | null }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.runQuery(
      internal.billingQueries.getUserByClerkId,
      { clerkId: identity.subject },
    )
    if (!user) throw new Error('User not found')

    const productId = process.env.POLAR_PRO_PRODUCT_ID
    if (!productId) throw new Error('POLAR_PRO_PRODUCT_ID not configured')

    const polar = getPolar()
    const checkout = await polar.checkouts.create({
      products: [productId],
      externalCustomerId: user.clerkId,
      customerEmail: user.email,
      successUrl: `${args.returnUrl}?checkout=success`,
    })

    return { url: checkout.url }
  },
})

export const createPortalSession = action({
  args: {
    returnUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.runQuery(
      internal.billingQueries.getUserByClerkId,
      { clerkId: identity.subject },
    )
    if (!user?.polarCustomerId)
      throw new Error('No Polar customer found')

    const polar = getPolar()
    const session = await polar.customerSessions.create({
      customerId: user.polarCustomerId,
      returnUrl: args.returnUrl,
    })

    return { url: session.customerPortalUrl }
  },
})

export const handleWebhookEvent = internalAction({
  args: {
    payload: v.string(),
    webhookId: v.string(),
    webhookTimestamp: v.string(),
    webhookSignature: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET
    if (!webhookSecret) throw new Error('POLAR_WEBHOOK_SECRET not configured')

    const headers = {
      'webhook-id': args.webhookId,
      'webhook-timestamp': args.webhookTimestamp,
      'webhook-signature': args.webhookSignature,
    }

    let event: ReturnType<typeof validateEvent>
    try {
      event = validateEvent(args.payload, headers, webhookSecret)
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        throw new Error('Invalid webhook signature')
      }
      // Unknown event type (e.g. member.created) — signature was valid but event isn't recognized
      console.log('Ignoring unhandled webhook event:', (err as Error).message)
      return
    }

    switch (event.type) {
      case 'subscription.active': {
        const sub = event.data
        const clerkId = sub.customer.externalId
        if (!clerkId) {
          console.error('subscription.active: no customer externalId')
          return
        }
        await ctx.runMutation(
          internal.billingMutations.activateSubscription,
          {
            clerkId,
            polarCustomerId: sub.customer.id,
            subscriptionId: sub.id,
            currentPeriodStart: new Date(sub.currentPeriodStart).getTime(),
            currentPeriodEnd: new Date(
              sub.currentPeriodEnd ?? sub.currentPeriodStart,
            ).getTime(),
          },
        )
        break
      }

      case 'subscription.updated': {
        const sub = event.data
        const clerkId = sub.customer.externalId
        if (!clerkId) return

        await ctx.runMutation(
          internal.billingMutations.updateSubscriptionStatus,
          {
            clerkId,
            subscriptionId: sub.id,
            status: sub.status,
            currentPeriodStart: new Date(sub.currentPeriodStart).getTime(),
            currentPeriodEnd: new Date(
              sub.currentPeriodEnd ?? sub.currentPeriodStart,
            ).getTime(),
          },
        )

        // Also attempt credit renewal (idempotent - skips if period unchanged)
        await ctx.runMutation(internal.billingMutations.renewSubscription, {
          clerkId,
          currentPeriodStart: new Date(sub.currentPeriodStart).getTime(),
          currentPeriodEnd: new Date(
            sub.currentPeriodEnd ?? sub.currentPeriodStart,
          ).getTime(),
        })
        break
      }

      case 'subscription.canceled': {
        const sub = event.data
        const clerkId = sub.customer.externalId
        if (!clerkId) return
        await ctx.runMutation(
          internal.billingMutations.updateSubscriptionStatus,
          {
            clerkId,
            subscriptionId: sub.id,
            status: sub.status,
            currentPeriodStart: new Date(sub.currentPeriodStart).getTime(),
            currentPeriodEnd: new Date(
              sub.currentPeriodEnd ?? sub.currentPeriodStart,
            ).getTime(),
          },
        )
        break
      }

      case 'subscription.revoked': {
        const sub = event.data
        const clerkId = sub.customer.externalId
        if (!clerkId) return
        await ctx.runMutation(internal.billingMutations.cancelSubscription, {
          clerkId,
        })
        break
      }
    }
  },
})
