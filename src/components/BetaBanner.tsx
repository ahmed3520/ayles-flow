import { useMatch } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { MessageSquare, Send, X } from 'lucide-react'
import { useState } from 'react'

import { api } from '../../convex/_generated/api'

const FEEDBACK_TYPES = [
  { value: 'bug' as const, label: 'Bug' },
  { value: 'feedback' as const, label: 'Feedback' },
  { value: 'feature' as const, label: 'Feature request' },
]

export default function BetaBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'bug' | 'feedback' | 'feature'>('bug')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  const submitFeedback = useMutation(api.feedback.submit)

  const isCanvas = useMatch({ from: '/canvas/$projectId', shouldThrow: false })
  const compact = !!isCanvas

  if (dismissed) return null

  const handleSubmit = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      await submitFeedback({
        type,
        message: message.trim(),
        email: email.trim() || undefined,
        page: typeof window !== 'undefined' ? window.location.pathname : undefined,
      })
      setSubmitted(true)
      setTimeout(() => {
        setOpen(false)
        setSubmitted(false)
        setMessage('')
        setEmail('')
      }, 2000)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Banner bar */}
      <div className={`relative z-[60] bg-indigo-600/90 backdrop-blur-sm ${compact ? 'py-0' : ''}`}>
        <div className={`mx-auto flex items-center justify-center gap-2 px-4 text-white ${compact ? 'py-1 text-[11px]' : 'py-2 gap-3 text-[13px]'}`}>
          <span className={`inline-flex items-center rounded-full bg-white/15 font-semibold uppercase tracking-wide ${compact ? 'px-1.5 py-px text-[9px]' : 'gap-1.5 px-2 py-0.5 text-[11px]'}`}>
            Beta
          </span>
          {!compact && (
            <span className="text-white/90">
              We're in early beta — some features may break.
            </span>
          )}
          <button
            onClick={() => setOpen(true)}
            className={`inline-flex items-center rounded-full bg-white/15 font-medium hover:bg-white/25 transition-colors cursor-pointer ${compact ? 'gap-1 px-2 py-0.5 text-[10px]' : 'gap-1.5 px-3 py-1 text-[12px]'}`}
          >
            <MessageSquare size={compact ? 10 : 12} />
            Feedback
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-white/15 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X size={compact ? 12 : 14} className="text-white/70" />
          </button>
        </div>
      </div>

      {/* Feedback modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !sending && setOpen(false)}
          />
          <div className="relative w-full max-w-md mx-4 rounded-2xl border border-zinc-800/60 bg-zinc-900 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
              <h3 className="text-[15px] font-semibold text-zinc-200">
                Send feedback
              </h3>
              <button
                onClick={() => !sending && setOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={16} className="text-zinc-500" />
              </button>
            </div>

            {submitted ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Send size={18} className="text-emerald-400" />
                </div>
                <p className="text-[14px] font-medium text-zinc-200">Thanks for your feedback!</p>
                <p className="text-[13px] text-zinc-500 mt-1">We'll look into it.</p>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-4">
                {/* Type selector */}
                <div className="flex gap-2">
                  {FEEDBACK_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                        type === t.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Message */}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    type === 'bug'
                      ? 'What broke? What did you expect to happen?'
                      : type === 'feature'
                        ? 'What would you like to see?'
                        : 'Tell us what you think...'
                  }
                  rows={4}
                  className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-4 py-3 text-[13px] text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors"
                />

                {/* Email (optional) */}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional — for follow-up)"
                  className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-4 py-2.5 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || sending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors cursor-pointer"
                >
                  <Send size={14} />
                  {sending ? 'Sending...' : 'Send feedback'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
