import {
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
} from '@clerk/tanstack-react-start'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import {
  ArrowLeft,
  Check,
  CreditCard,
  Crown,
  ExternalLink,
  Loader2,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '../../convex/_generated/api'
import { buildSeoHead } from '@/utils/seo'

export const Route = createFileRoute('/billing')({
  head: () =>
    buildSeoHead({
      title: 'Billing | Ayles Flow',
      description: 'Manage your Ayles Flow plan and credits.',
      path: '/billing',
      noindex: true,
    }),
  headers: () => ({
    'X-Robots-Tag': 'noindex, nofollow',
  }),
  component: BillingPage,
  ssr: false,
})

function StoreUser({ storeUser }: { storeUser: () => void }) {
  useEffect(() => {
    storeUser()
  }, [storeUser])

  return null
}

function BillingContent() {
  const subscription = useQuery(api.billingQueries.getSubscription)
  const transactions = useQuery(api.billingQueries.getCreditTransactions, {
    limit: 30,
  })
  const createCheckout = useAction(api.billing.createCheckoutSession)
  const createPortal = useAction(api.billing.createPortalSession)
  const [loading, setLoading] = useState<'upgrade' | 'manage' | null>(null)

  const isPro = subscription?.plan === 'pro'
  const credits = subscription?.credits ?? 0
  const creditsLimit = subscription?.creditsLimit ?? 10
  const creditPercent = creditsLimit > 0 ? (credits / creditsLimit) * 100 : 0

  const handleUpgrade = async () => {
    setLoading('upgrade')
    try {
      const { url } = await createCheckout({
        returnUrl: window.location.origin + '/billing',
      })
      if (url) window.location.href = url
    } finally {
      setLoading(null)
    }
  }

  const handleManage = async () => {
    setLoading('manage')
    try {
      const { url } = await createPortal({
        returnUrl: window.location.origin + '/billing',
      })
      if (url) window.location.href = url
    } finally {
      setLoading(null)
    }
  }

  if (!subscription) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="text-zinc-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">Billing</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Manage your plan and credits
              </p>
            </div>
          </div>
          <UserButton appearance={{ elements: { avatarBox: 'w-9 h-9' } }} />
        </div>

        {/* Current Plan Card */}
        <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {isPro ? (
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                  <Crown size={16} className="text-indigo-400" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Zap size={16} className="text-zinc-400" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-zinc-100">
                    {isPro ? 'Pro' : 'Free'} Plan
                  </span>
                  {isPro && (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                      Active
                    </span>
                  )}
                </div>
                {isPro && subscription.currentPeriodEnd && (
                  <span className="text-xs text-zinc-500">
                    {subscription.subscriptionStatus === 'canceled'
                      ? 'Cancels'
                      : 'Renews'}{' '}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString(
                      undefined,
                      { month: 'long', day: 'numeric', year: 'numeric' },
                    )}
                  </span>
                )}
              </div>
            </div>
            {isPro ? (
              <button
                onClick={handleManage}
                disabled={loading !== null}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-xl transition-colors border border-zinc-700/50"
              >
                {loading === 'manage' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ExternalLink size={14} />
                )}
                Manage Subscription
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={loading !== null}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {loading === 'upgrade' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Crown size={14} />
                )}
                Upgrade to Pro
              </button>
            )}
          </div>

          {/* Credits bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Credits</span>
              <span className="text-sm font-medium text-zinc-200">
                {credits.toFixed(2)} / {creditsLimit.toFixed(2)}
              </span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  creditPercent > 20
                    ? 'bg-indigo-500'
                    : creditPercent > 5
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(creditPercent, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Plan Comparison */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <PlanCard
            name="Free"
            price="$0"
            features={[
              '10 credits / month',
              'All AI models',
              'Unlimited projects',
            ]}
            current={!isPro}
          />
          <PlanCard
            name="Pro"
            price="$17"
            features={[
              '500 credits / month',
              'All AI models',
              'Unlimited projects',
              'Priority support',
            ]}
            current={isPro}
            highlighted
          />
        </div>

        {/* Credit History */}
        <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/60">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <CreditCard size={14} className="text-zinc-400" />
              Credit History
            </h2>
          </div>
          {!transactions || transactions.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-zinc-600">
              No transactions yet
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/40">
              {transactions.map((tx) => (
                <div
                  key={tx._id}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <div>
                    <span className="text-sm text-zinc-300">
                      {tx.description}
                    </span>
                    <div className="text-[11px] text-zinc-600 mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-medium ${
                        tx.amount < 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {tx.amount < 0 ? '' : '+'}
                      {tx.amount.toFixed(3)}
                    </span>
                    <div className="text-[11px] text-zinc-600">
                      bal: {tx.balance.toFixed(3)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PlanCard({
  name,
  price,
  features,
  current,
  highlighted,
}: {
  name: string
  price: string
  features: string[]
  current: boolean
  highlighted?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlighted
          ? 'bg-indigo-600/5 border-indigo-500/30'
          : 'bg-zinc-900 border-zinc-800/60'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-200">{name}</span>
        {current && (
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-zinc-800 text-zinc-400">
            Current
          </span>
        )}
      </div>
      <div className="mb-4">
        <span className="text-2xl font-bold text-zinc-100">{price}</span>
        <span className="text-sm text-zinc-500"> / month</span>
      </div>
      <ul className="space-y-2">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-center gap-2 text-sm text-zinc-400"
          >
            <Check size={14} className="text-zinc-600 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}

function BillingPage() {
  const storeUser = useMutation(api.users.store)

  return (
    <div className="min-h-screen bg-zinc-950">
      <SignedIn>
        <StoreUser storeUser={storeUser} />
        <BillingContent />
      </SignedIn>
      <SignedOut>
        <div className="fixed inset-0 flex items-center justify-center bg-zinc-950">
          <SignIn routing="hash" />
        </div>
      </SignedOut>
    </div>
  )
}
