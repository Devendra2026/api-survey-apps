import type { SurveyEditableFields, SurveyPatch, SurveyRecord } from "@/features/surveys/types"
import { getApiErrorMessage, isRetryableNetworkError } from "@/services/api/client"
import { patchSurvey } from "@/services/api/surveys"
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { AppState } from "react-native"
import { applyPatch, isEmptyPatch, mergePatch, recordToFields, subtractSentPatch } from "../lib/patch"
import { clearPendingPatch, loadPendingPatch, savePendingPatch } from "../lib/pending-store"
import { syncReducer, type SyncStatus } from "../lib/sync-state"
import { useRecordCache } from "./queries"

const SAVE_DEBOUNCE_MS = 800
const PERSIST_DEBOUNCE_MS = 250
const RETRY_DELAYS_MS = [3_000, 10_000, 30_000, 60_000]

type SaveOutcome = "ok" | "network" | "rejected"

type Options = {
  userId: string
  record: SurveyRecord | undefined
  /** False when the survey is not editable (submitted, approved, rejected-not-reopened). */
  enabled: boolean
}

export type SurveyAutosave = {
  fields: SurveyEditableFields | null
  status: SyncStatus
  setFields: (patch: SurveyPatch, options?: { immediate?: boolean }) => void
  /** Sends everything pending now. Resolves true only when the server confirmed all local edits. */
  flush: () => Promise<boolean>
  retry: () => void
  hasPending: boolean
}

export function useSurveyAutosave({ userId, record, enabled }: Options): SurveyAutosave {
  const recordCache = useRecordCache()
  const surveyId = record?.id ?? null
  const [status, dispatch] = useReducer(syncReducer, { kind: "idle" })
  const [pending, setPending] = useState<SurveyPatch>({})
  const pendingRef = useRef<SurveyPatch>({})
  const inFlightRef = useRef<Promise<SaveOutcome> | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryAttemptRef = useRef(0)
  const mountedRef = useRef(true)

  const updatePending = useCallback((next: SurveyPatch) => {
    pendingRef.current = next
    if (mountedRef.current) setPending(next)
  }, [])

  const persistSoon = useCallback(() => {
    if (!surveyId) return
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      void savePendingPatch(userId, surveyId, pendingRef.current)
    }, PERSIST_DEBOUNCE_MS)
  }, [userId, surveyId])

  const saveOnce = useCallback(async (): Promise<SaveOutcome> => {
    if (!surveyId || !enabled) return isEmptyPatch(pendingRef.current) ? "ok" : "rejected"
    const sent = pendingRef.current
    if (isEmptyPatch(sent)) return "ok"

    dispatch({ type: "saveStart" })
    try {
      const saved = await patchSurvey(surveyId, sent)
      retryAttemptRef.current = 0
      const remaining = subtractSentPatch(pendingRef.current, sent)
      updatePending(remaining)
      recordCache.write(saved)
      if (isEmptyPatch(remaining)) {
        await clearPendingPatch(userId, surveyId)
      } else {
        await savePendingPatch(userId, surveyId, remaining)
      }
      dispatch({ type: "saveSuccess", at: Date.now(), hasMoreChanges: !isEmptyPatch(remaining) })
      return "ok"
    } catch (error) {
      await savePendingPatch(userId, surveyId, pendingRef.current)
      const network = isRetryableNetworkError(error)
      dispatch({ type: "saveError", message: getApiErrorMessage(error, "Could not save"), network })
      return network ? "network" : "rejected"
    }
  }, [surveyId, enabled, userId, recordCache, updatePending])

  const runSave = useCallback((): Promise<SaveOutcome> => {
    // Serialize: edits made during an in-flight request are sent right after it, never in parallel.
    const previous: Promise<SaveOutcome> = inFlightRef.current ?? Promise.resolve("ok")
    const task = previous.then(async () => {
      let outcome = await saveOnce()
      while (outcome === "ok" && !isEmptyPatch(pendingRef.current)) {
        outcome = await saveOnce()
      }
      return outcome
    })
    inFlightRef.current = task
    const clear = () => {
      if (inFlightRef.current === task) inFlightRef.current = null
    }
    task.then(clear, clear)
    return task
  }, [saveOnce])

  const scheduleSave = useCallback(
    (delayMs: number) => {
      function arm(ms: number) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
          saveTimerRef.current = null
          void runSave().then((outcome) => {
            // Only network failures auto-retry; a 4xx is a server decision that waits for the user's Retry.
            if (outcome !== "network" || !mountedRef.current || isEmptyPatch(pendingRef.current)) return
            const attempt = Math.min(retryAttemptRef.current, RETRY_DELAYS_MS.length - 1)
            retryAttemptRef.current += 1
            arm(RETRY_DELAYS_MS[attempt]!)
          })
        }, ms)
      }
      arm(delayMs)
    },
    [runSave]
  )

  // Restore unsent edits from device storage (app was killed or offline last time).
  useEffect(() => {
    if (!surveyId) return
    let cancelled = false
    void loadPendingPatch(userId, surveyId).then((stored) => {
      if (cancelled || isEmptyPatch(stored)) return
      updatePending(mergePatch(stored, pendingRef.current))
      dispatch({ type: "edit" })
      if (enabled) scheduleSave(0)
    })
    return () => {
      cancelled = true
    }
  }, [userId, surveyId, enabled, scheduleSave, updatePending])

  useEffect(() => {
    mountedRef.current = true
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") {
        if (surveyId) void savePendingPatch(userId, surveyId, pendingRef.current)
        if (!isEmptyPatch(pendingRef.current)) void runSave()
      }
    })
    return () => {
      mountedRef.current = false
      sub.remove()
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
      if (surveyId && !isEmptyPatch(pendingRef.current)) {
        void savePendingPatch(userId, surveyId, pendingRef.current)
        void runSave()
      }
    }
  }, [userId, surveyId, runSave])

  const setFields = useCallback(
    (patch: SurveyPatch, options?: { immediate?: boolean }) => {
      updatePending(mergePatch(pendingRef.current, patch))
      dispatch({ type: "edit" })
      persistSoon()
      if (enabled) scheduleSave(options?.immediate ? 0 : SAVE_DEBOUNCE_MS)
    },
    [enabled, persistSoon, scheduleSave, updatePending]
  )

  const flush = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (isEmptyPatch(pendingRef.current) && !inFlightRef.current) return true
    const outcome = await runSave()
    return outcome === "ok" && isEmptyPatch(pendingRef.current)
  }, [runSave])

  const retry = useCallback(() => {
    retryAttemptRef.current = 0
    scheduleSave(0)
  }, [scheduleSave])

  const baseFields = useMemo(() => (record ? recordToFields(record) : null), [record])
  const fields = useMemo(() => (baseFields ? applyPatch(baseFields, pending) : null), [baseFields, pending])

  return { fields, status, setFields, flush, retry, hasPending: !isEmptyPatch(pending) }
}
