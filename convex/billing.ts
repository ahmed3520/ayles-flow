'use node'

import Stripe from 'stripe'
import { v } from 'convex/values'

import { internal } from './_generated/api'
import { action, internalAction } from './_generated/server'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key)
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0]
  return {
    start: item.current_period_start * 1000,
    end: item.current_period_end * 1000,
  }
}

export const createCheckoutSession = action({
  args: {
    returnUrl: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ url: string | null }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.runQuery(
      internal.billingQueries.getUserByClerkId,
      { clerkId: identity.subject },
    )
    if (!user) throw new Error('User not found')

    const stripe = getStripe()

    let customerId: string | undefined = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { convexUserId: user._id, clerkId: user.clerkId },
      })
      customerId = customer.id
      await ctx.runMutation(internal.billingMutations.setStripeCustomerId, {
        userId: user._id,
        stripeCustomerId: customer.id,
      })
    }

    const priceId = process.env.STRIPE_PRO_PRICE_ID
    if (!priceId) throw new Error('STRIPE_PRO_PRICE_ID not configured')

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${args.returnUrl}?checkout=success`,
      cancel_url: `${args.returnUrl}?checkout=canceled`,
      metadata: { convexUserId: user._id },
    })

    return { url: session.url }
  },
})

export const createPortalSession = action({
  args: {
    returnUrl: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const user = await ctx.runQuery(
      internal.billingQueries.getUserByClerkId,
      { clerkId: identity.subject },
    )
    if (!user?.stripeCustomerId) throw new Error('No Stripe customer found')

    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: args.returnUrl,
    })

    return { url: session.url }
  },
})

export const handleWebhookEvent = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const stripe = getStripe()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret)
      throw new Error('STRIPE_WEBHOOK_SECRET not configured')

    const event = stripe.webhooks.constructEvent(
      args.payload,
      args.signature,
      webhookSecret,
    )

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string,
            { expand: ['items.data'] },
          )
          const period = getSubscriptionPeriod(subscription)
          await ctx.runMutation(
            internal.billingMutations.activateSubscription,
            {
              stripeCustomerId: session.customer as string,
              subscriptionId: subscription.id,
              currentPeriodStart: period.start,
              currentPeriodEnd: period.end,
            },
          )
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const subDetail =
          invoice.parent?.subscription_details?.subscription
        const subId =
          (typeof subDetail === 'string' ? subDetail : subDetail?.id) ??
          (invoice.lines.data[0]?.subscription as string | undefined)
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId, {
            expand: ['items.data'],
          })
          const period = getSubscriptionPeriod(subscription)
          await ctx.runMutation(
            internal.billingMutations.renewSubscription,
            {
              stripeCustomerId: invoice.customer as string,
              currentPeriodStart: period.start,
              currentPeriodEnd: period.end,
            },
          )
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const period = getSubscriptionPeriod(subscription)
        await ctx.runMutation(
          internal.billingMutations.updateSubscriptionStatus,
          {
            stripeCustomerId: subscription.customer as string,
            subscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
          },
        )
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        await ctx.runMutation(
          internal.billingMutations.cancelSubscription,
          {
            stripeCustomerId: subscription.customer as string,
          },
        )
        break
      }
    }
  },
})
