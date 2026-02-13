import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

crons.daily(
  'reset-free-credits',
  { hourUTC: 0, minuteUTC: 0 },
  internal.billingMutations.resetFreeCredits,
)

export default crons
