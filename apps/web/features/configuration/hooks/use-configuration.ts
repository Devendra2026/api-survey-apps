"use client"

import { apiGet, apiPatch, apiPost, apiPut } from "@/lib/api/client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ConfigAuditLog,
  GeographyTreeNode,
  ReferenceCategory,
  ReferenceEntry,
  TaxConfig,
  TaxConfigVersion,
  TaxPreviewResult,
} from "../lib/types"

export function useReferenceCategories() {
  return useQuery({
    queryKey: ["configuration", "categories"],
    queryFn: () => apiGet<ReferenceCategory[]>("/configuration/categories"),
  })
}

export function useReferenceEntries(
  categoryCode: string,
  params?: { search?: string; status?: string; page?: number; limit?: number }
) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set("search", params.search)
  if (params?.status) qs.set("status", params.status)
  if (params?.page) qs.set("page", String(params.page))
  if (params?.limit) qs.set("limit", String(params.limit))

  return useQuery({
    queryKey: ["configuration", "entries", categoryCode, params],
    queryFn: () =>
      apiGet<{
        category: ReferenceCategory
        items: ReferenceEntry[]
        meta: { total: number; page: number; limit: number; totalPages: number }
      }>(`/configuration/categories/${categoryCode}/entries?${qs}`),
    enabled: Boolean(categoryCode),
  })
}

export function useReferenceMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["configuration"] })
  }

  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) => apiPost<ReferenceEntry>("/configuration/entries", body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
        apiPatch<ReferenceEntry>(`/configuration/entries/${id}`, body),
      onSuccess: invalidate,
    }),
    clone: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
        apiPost<ReferenceEntry>(`/configuration/entries/${id}/clone`, body),
      onSuccess: invalidate,
    }),
    bulkStatus: useMutation({
      mutationFn: (body: { ids: string[]; status: string; reason?: string }) =>
        apiPost<{ updated: number }>("/configuration/entries/bulk-status", body),
      onSuccess: invalidate,
    }),
  }
}

export function useGeographyTree(stateId?: string) {
  const qs = stateId ? `?stateId=${stateId}` : ""
  return useQuery({
    queryKey: ["configuration", "geography-tree", stateId],
    queryFn: () => apiGet<GeographyTreeNode[]>(`/configuration/geography/tree${qs}`),
  })
}

/** Unscoped wards for Master Data ULB expand (aligned with tree ward counts). */
export function useGeographyUlbWards(ulbId?: string) {
  return useQuery({
    queryKey: ["configuration", "geography-ulb-wards", ulbId],
    queryFn: () => apiGet<GeographyTreeNode[]>(`/configuration/geography/ulbs/${ulbId}/wards`),
    enabled: Boolean(ulbId),
  })
}

export function useConfigAudit(params?: { entityType?: string; entityId?: string }) {
  const qs = new URLSearchParams()
  if (params?.entityType) qs.set("entityType", params.entityType)
  if (params?.entityId) qs.set("entityId", params.entityId)
  return useQuery({
    queryKey: ["configuration", "audit", params],
    queryFn: () => apiGet<ConfigAuditLog[]>(`/configuration/audit?${qs}`),
  })
}

export function useTaxConfig(wardId?: string, assessmentYearId?: string) {
  return useQuery({
    queryKey: ["tax-configs", wardId, assessmentYearId],
    queryFn: () => apiGet<TaxConfig>(`/tax-configs?wardId=${wardId}&assessmentYearId=${assessmentYearId}`),
    enabled: Boolean(wardId && assessmentYearId),
  })
}

export function useTaxConfigMutations() {
  const qc = useQueryClient()
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["tax-configs"] })

  return {
    updateParams: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
        apiPatch<TaxConfig>(`/tax-configs/${id}`, body),
      onSuccess: invalidate,
    }),
    upsertCells: useMutation({
      mutationFn: ({ id, cells }: { id: string; cells: unknown[] }) =>
        apiPut<TaxConfig>(`/tax-configs/${id}/cells`, { cells }),
      onSuccess: invalidate,
    }),
    bulkApply: useMutation({
      mutationFn: (body: {
        ulbId: string
        assessmentYearId: string
        mode: "copy" | "zero"
        sourceWardId?: string
        cells?: unknown[]
      }) => apiPost<{ updated: number }>("/tax-configs/bulk-apply", body),
      onSuccess: invalidate,
    }),
    preview: useMutation({
      mutationFn: (body: Record<string, unknown>) => apiPost<TaxPreviewResult>("/tax-configs/preview", body),
    }),
    publish: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
        apiPost<TaxConfig>(`/tax-configs/${id}/publish`, body),
      onSuccess: invalidate,
    }),
    rollback: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
        apiPost<TaxConfig>(`/tax-configs/${id}/rollback`, body),
      onSuccess: invalidate,
    }),
  }
}

export function useTaxVersions(taxConfigId?: string) {
  return useQuery({
    queryKey: ["tax-configs", taxConfigId, "versions"],
    queryFn: () => apiGet<TaxConfigVersion[]>(`/tax-configs/${taxConfigId}/versions`),
    enabled: Boolean(taxConfigId),
  })
}
