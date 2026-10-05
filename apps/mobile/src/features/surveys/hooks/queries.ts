import type { QcStatus, SurveyRecord, SurveyStatus } from "@/features/surveys/types"
import { getFieldMetrics, getSurveyRecord, listSurveys, listWards, type SurveyListParams } from "@/services/api/surveys"
import { useAuth } from "@clerk/expo"
import { useInfiniteQuery, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import { mergeCoOwners } from "../lib/owner-mapping"

/**
 * Survey data is user-owned: every key carries the Clerk userId so one user's cached
 * records, lists, and metrics can never be read under another user's session.
 */
export const surveyKeys = {
  owner: (clerkUserId: string) => ["surveys", clerkUserId] as const,
  record: (clerkUserId: string, id: string) => ["surveys", clerkUserId, "record", id] as const,
  lists: (clerkUserId: string) => ["surveys", clerkUserId, "list"] as const,
  list: (clerkUserId: string, params: Omit<SurveyListParams, "cursor">) =>
    ["surveys", clerkUserId, "list", params] as const,
  metricsAll: (clerkUserId: string) => ["surveys", clerkUserId, "metrics"] as const,
  metrics: (clerkUserId: string, scope: "self" | "team") => ["surveys", clerkUserId, "metrics", scope] as const,
  /** Ward catalog is shared reference data, not user-owned. */
  wards: (ulbId: string) => ["wards", ulbId] as const,
}

/** Current Clerk userId, or "" while Clerk has no signed-in user (queries stay disabled). */
function useCacheOwner(): string {
  const { userId } = useAuth()
  return userId ?? ""
}

function localDayStartIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

export function useFieldMetrics(scope: "self" | "team") {
  const owner = useCacheOwner()
  return useQuery({
    queryKey: surveyKeys.metrics(owner, scope),
    queryFn: () => getFieldMetrics(scope, localDayStartIso()),
    enabled: Boolean(owner),
    staleTime: 60_000,
  })
}

export function useSurveyRecord(id: string | undefined) {
  const owner = useCacheOwner()
  return useQuery({
    queryKey: surveyKeys.record(owner, id ?? ""),
    queryFn: () => getSurveyRecord(id ?? ""),
    enabled: Boolean(owner && id),
    staleTime: 5 * 60_000,
  })
}

export type SurveyListFilter = {
  surveyStatus?: SurveyStatus
  qcStatus?: QcStatus
  surveyorId?: string
  wardId?: string
  search?: string
}

export function useSurveyList(filter: SurveyListFilter, enabled = true) {
  const owner = useCacheOwner()
  return useInfiniteQuery({
    queryKey: surveyKeys.list(owner, filter),
    queryFn: ({ pageParam }) => listSurveys({ ...filter, cursor: pageParam, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.nextCursor,
    enabled: enabled && Boolean(owner),
    staleTime: 30_000,
  })
}

export function useUlbWards(ulbId: string | null) {
  return useQuery({
    queryKey: surveyKeys.wards(ulbId ?? ""),
    queryFn: () => listWards(ulbId ?? ""),
    enabled: Boolean(ulbId),
    staleTime: 30 * 60_000,
  })
}

/** Writes a server-confirmed survey row into the record cache, keeping the QC thread the PATCH response omits. */
export function writeRecordCache(queryClient: QueryClient, owner: string, next: SurveyRecord): void {
  if (!owner) return
  queryClient.setQueryData<SurveyRecord>(surveyKeys.record(owner, next.id), (prev) => ({
    ...next,
    qcRemarkThread: next.qcRemarkThread ?? prev?.qcRemarkThread,
    coOwners: mergeCoOwners(prev?.coOwners, next.coOwners),
  }))
}

/** Applies a server-confirmed child change (floor, co-owner, photo) to the cached record. */
export function updateRecordCache(
  queryClient: QueryClient,
  owner: string,
  id: string,
  update: (record: SurveyRecord) => SurveyRecord
): void {
  if (!owner) return
  queryClient.setQueryData<SurveyRecord>(surveyKeys.record(owner, id), (prev) => (prev ? update(prev) : prev))
}

export type RecordCache = {
  write: (next: SurveyRecord) => void
  update: (id: string, update: (record: SurveyRecord) => SurveyRecord) => void
}

/** Record-cache writers bound to the signed-in Clerk user. */
export function useRecordCache(): RecordCache {
  const queryClient = useQueryClient()
  const owner = useCacheOwner()
  return useMemo(
    () => ({
      write: (next) => writeRecordCache(queryClient, owner, next),
      update: (id, update) => updateRecordCache(queryClient, owner, id, update),
    }),
    [queryClient, owner]
  )
}

/** After a lifecycle change (create/submit/reopen) the dashboards and lists must re-read the server. */
export function useInvalidateSurveyLists() {
  const queryClient = useQueryClient()
  const owner = useCacheOwner()
  return useCallback(() => {
    if (!owner) return
    void queryClient.invalidateQueries({ queryKey: surveyKeys.lists(owner) })
    void queryClient.invalidateQueries({ queryKey: surveyKeys.metricsAll(owner) })
  }, [queryClient, owner])
}
