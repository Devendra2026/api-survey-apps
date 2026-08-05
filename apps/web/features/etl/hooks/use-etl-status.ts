"use client"

import {
  cleanupEmptyDuplicateStates,
  dedupeWards,
  getEtlReport,
  getEtlStatus,
  listEtlJobs,
  retryEtlFailed,
  startEtlFull,
  startEtlIncremental,
  startEtlRefreshPending,
  startEtlValidate,
  syncWardsFromConvex,
} from "@/features/etl/lib/etl-api"
import { isEtlJobActive } from "@/features/etl/lib/types"
import { useAuthStore } from "@/stores/app-store"
import { useAuth } from "@clerk/nextjs"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

const ETL_STATUS_KEY = ["etl", "status"] as const
const ETL_JOBS_KEY = ["etl", "jobs"] as const

export function useEtlStatus(enabled = true) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission("etl:manage")

  return useQuery({
    queryKey: ETL_STATUS_KEY,
    queryFn: getEtlStatus,
    enabled: enabled && isLoaded && Boolean(isSignedIn) && canManage,
    refetchInterval: (query) => {
      if (isEtlJobActive(query.state.data?.activeJob?.status)) return 2000
      return false
    },
  })
}

export function useEtlJobs(enabled = true, limit = 20) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission("etl:manage")

  return useQuery({
    queryKey: [...ETL_JOBS_KEY, limit],
    queryFn: () => listEtlJobs(limit),
    enabled: enabled && isLoaded && Boolean(isSignedIn) && canManage,
    refetchInterval: (query) => {
      const items = query.state.data?.items
      if (!items?.length) return false
      const active = items.some((job) => isEtlJobActive(job.status))
      return active ? 2000 : false
    },
  })
}

export function useEtlReport(jobId: string | null) {
  return useQuery({
    queryKey: ["etl", "report", jobId],
    queryFn: () => getEtlReport(jobId!),
    enabled: Boolean(jobId),
  })
}

function useInvalidateEtl() {
  const qc = useQueryClient()
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ETL_STATUS_KEY }),
      qc.invalidateQueries({ queryKey: ETL_JOBS_KEY }),
    ])
  }
}

export function useStartEtlIncremental() {
  const invalidate = useInvalidateEtl()
  return useMutation({
    mutationFn: (batchSize?: number) => startEtlIncremental(batchSize),
    onSuccess: () => invalidate(),
  })
}

export function useStartEtlFull() {
  const invalidate = useInvalidateEtl()
  return useMutation({
    mutationFn: (opts?: { batchSize?: number; force?: boolean }) => startEtlFull(opts),
    onSuccess: () => invalidate(),
  })
}

export function useRetryEtlFailed() {
  const invalidate = useInvalidateEtl()
  return useMutation({
    mutationFn: (maxRetries?: number) => retryEtlFailed(maxRetries),
    onSuccess: () => invalidate(),
  })
}

export function useStartEtlValidate() {
  const invalidate = useInvalidateEtl()
  return useMutation({
    mutationFn: () => startEtlValidate(),
    onSuccess: () => invalidate(),
  })
}

export function useStartEtlRefreshPending() {
  const invalidate = useInvalidateEtl()
  return useMutation({
    mutationFn: (batchSize?: number) => startEtlRefreshPending(batchSize),
    onSuccess: () => invalidate(),
  })
}

export function useDedupeWards() {
  return useMutation({
    mutationFn: ({ apply, ulbCode }: { apply: boolean; ulbCode?: string }) => dedupeWards(apply, ulbCode),
  })
}

export function useSyncWardsFromConvex() {
  return useMutation({
    mutationFn: (apply: boolean) => syncWardsFromConvex(apply),
  })
}

export function useCleanupEmptyDuplicateStates() {
  return useMutation({
    mutationFn: (apply: boolean) => cleanupEmptyDuplicateStates(apply),
  })
}
