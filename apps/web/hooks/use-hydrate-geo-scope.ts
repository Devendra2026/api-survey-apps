"use client"

import { useDistrict, useUlb } from "@/hooks/use-api"
import { isQcRegistryTab, readScopeFromSearchParams } from "@/lib/ward-action-links"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef } from "react"

export type HydratedGeoScope = {
  stateId?: string
  districtId?: string
  ulbId?: string
  wardId?: string
  status?: string
}

/**
 * One-shot hydrate of geo scope from URL search params.
 * Resolves districtId/stateId from ulbId via GET /ulbs/:id and /districts/:id.
 */
export function useHydrateGeoScopeFromSearchParams(onHydrate: (scope: HydratedGeoScope) => void) {
  const searchParams = useSearchParams()
  const applied = useRef(false)
  const onHydrateRef = useRef(onHydrate)
  onHydrateRef.current = onHydrate

  const fromUrl = useMemo(() => readScopeFromSearchParams(searchParams), [searchParams])
  const hasUrlScope = Boolean(fromUrl.ulbId || fromUrl.wardId || fromUrl.status)

  const ulbQuery = useUlb(!applied.current && fromUrl.ulbId ? fromUrl.ulbId : undefined)
  const districtQuery = useDistrict(ulbQuery.data?.districtId)

  useEffect(() => {
    if (applied.current || !hasUrlScope) return

    if (fromUrl.ulbId) {
      if (ulbQuery.isLoading) return
      if (ulbQuery.isError || !ulbQuery.data) {
        applied.current = true
        onHydrateRef.current({
          ulbId: fromUrl.ulbId,
          wardId: fromUrl.wardId,
          status: fromUrl.status && isQcRegistryTab(fromUrl.status) ? fromUrl.status : fromUrl.status,
        })
        return
      }
      if (districtQuery.isLoading) return

      applied.current = true
      onHydrateRef.current({
        stateId: districtQuery.data?.stateId,
        districtId: ulbQuery.data.districtId,
        ulbId: fromUrl.ulbId,
        wardId: fromUrl.wardId,
        status: fromUrl.status && isQcRegistryTab(fromUrl.status) ? fromUrl.status : fromUrl.status,
      })
      return
    }

    applied.current = true
    onHydrateRef.current({
      wardId: fromUrl.wardId,
      status: fromUrl.status && isQcRegistryTab(fromUrl.status) ? fromUrl.status : fromUrl.status,
    })
  }, [
    hasUrlScope,
    fromUrl,
    ulbQuery.isLoading,
    ulbQuery.isError,
    ulbQuery.data,
    districtQuery.isLoading,
    districtQuery.data,
  ])
}
