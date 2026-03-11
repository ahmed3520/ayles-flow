import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'

import { api } from '../../convex/_generated/api'
import type { Edge, Node } from '@xyflow/react'

import type { Id } from '../../convex/_generated/dataModel'

export type SaveStatus = 'saved' | 'saving' | 'unsaved'

type UseAutoSaveOptions = {
  projectId: Id<'projects'>
  nodes: Array<Node>
  edges: Array<Edge>
  enabled: boolean
  debounceMs?: number
}

export function useAutoSave({
  projectId,
  nodes,
  edges,
  enabled,
  debounceMs = 500,
}: UseAutoSaveOptions) {
  const updateProject = useMutation(api.projects.update)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savePromiseRef = useRef<Promise<void> | null>(null)
  const changeVersionRef = useRef(0)
  const savedVersionRef = useRef(0)
  const isSavingRef = useRef(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')

  // Keep latest nodes/edges in refs so the save callback always has fresh data
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  const save = useCallback(async () => {
    if (isSavingRef.current) {
      await savePromiseRef.current
      return
    }

    if (changeVersionRef.current === savedVersionRef.current) {
      setSaveStatus('saved')
      return
    }

    isSavingRef.current = true
    setSaveStatus('saving')
    const versionAtSave = changeVersionRef.current

    const savePromise = updateProject({
      id: projectId,
      nodes: nodesRef.current as Array<any>,
      edges: edgesRef.current as Array<any>,
    })
      .then(() => {
        savedVersionRef.current = versionAtSave
        setSaveStatus(
          changeVersionRef.current === versionAtSave ? 'saved' : 'unsaved',
        )
      })
      .catch(() => {
        setSaveStatus('unsaved')
      })
      .finally(() => {
        isSavingRef.current = false
        savePromiseRef.current = null
        // If more changes happened while saving, schedule another save
        if (changeVersionRef.current !== savedVersionRef.current) {
          timerRef.current = setTimeout(() => {
            void save()
          }, debounceMs)
        }
      })
    savePromiseRef.current = savePromise
    await savePromise
  }, [projectId, updateProject, debounceMs])

  useEffect(() => {
    if (!enabled) return

    changeVersionRef.current++
    setSaveStatus('unsaved')

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void save()
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [nodes, edges, enabled, save, debounceMs])

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        void save()
      }
    }
  }, [save])

  const flushSave = useCallback(async () => {
    if (!enabled) return
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    while (changeVersionRef.current !== savedVersionRef.current) {
      await save()
    }
  }, [enabled, save])

  const initializeBaseline = useCallback(() => {
    changeVersionRef.current = 0
    savedVersionRef.current = 0
  }, [])

  return { saveStatus, initializeBaseline, flushSave }
}
