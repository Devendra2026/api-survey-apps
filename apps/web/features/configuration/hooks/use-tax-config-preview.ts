"use client"

import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { apiPost, getApiErrorMessage } from "@/lib/api/client"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  createRequestGenerationGate,
  parseTaxPreviewRequestKey,
  taxPreviewRequestKey,
} from "../lib/tax-preview-request"
import type { TaxPreviewResult } from "../lib/types"

const PREVIEW_DEBOUNCE_MS = 400

/**
 * Debounced tax preview against POST /tax-configs/preview.
 *
 * Important: does NOT use React Query useMutation — mutation result identity changes on
 * every status update, which previously recreated a useCallback/useEffect loop and
 * flooded the API until Nest ThrottlerException (HTTP 429).
 */
export function useTaxConfigPreview(input: {
  wardId?: string
  assessmentYearId?: string
  areaSqFt: number
  roadWidthEntryId?: string
  constructionEntryId?: string
}): {
  preview: TaxPreviewResult | null
} {
  const [preview, setPreview] = useState<TaxPreviewResult | null>(null)
  const gateRef = useRef(createRequestGenerationGate())

  const requestKey = taxPreviewRequestKey(input)
  const debouncedKey = useDebouncedValue(requestKey, PREVIEW_DEBOUNCE_MS)

  useEffect(() => {
    if (!debouncedKey) return

    const body = parseTaxPreviewRequestKey(debouncedKey)
    if (!body.wardId || !Number.isFinite(body.areaSqFt)) return

    const requestId = gateRef.current.next()
    let cancelled = false

    void (async () => {
      try {
        const result = await apiPost<TaxPreviewResult>("/tax-configs/preview", body)
        if (cancelled || !gateRef.current.isCurrent(requestId)) return
        setPreview(result)
      } catch (error) {
        if (cancelled || !gateRef.current.isCurrent(requestId)) return
        toast.error(getApiErrorMessage(error) || "Preview failed")
      }
    })()

    return () => {
      cancelled = true
      // Do not invalidate the gate here — that races the next effect's requestId.
      // cancelled + comparing request ids from next() is enough for in-flight drops.
    }
  }, [debouncedKey])

  return { preview }
}
