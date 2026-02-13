import { useQuery } from 'convex/react'

import { api } from '../../convex/_generated/api'

export function useGenerationStatus(generationId?: string) {
  return useQuery(
    api.generations.get,
    generationId ? { id: generationId as never } : 'skip',
  )
}
