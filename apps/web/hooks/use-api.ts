import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost, apiUpload } from "@/lib/api/client"
import type {
  AuthenticatedProfile,
  BulkActionResult,
  BulkExportResult,
  DashboardSummary,
  GeoDistrict,
  GeoState,
  GeoUlb,
  GeoWard,
  ImportEnqueueResult,
  ImportJob,
  NotificationItem,
  PaginatedResult,
  SavedView,
  SurveyListItem,
  WardCommandStat,
} from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { useAuth } from "@clerk/nextjs"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export function useCurrentUser() {
  const { isLoaded, isSignedIn, getToken } = useAuth()

  return useQuery({
    queryKey: ["users", "me"],
    enabled: isLoaded && Boolean(isSignedIn),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error("Missing auth token")
      return apiGet<AuthenticatedProfile>("/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
  })
}

export function useDashboardSummary() {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("dashboard:view")

  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiGet<DashboardSummary>("/dashboard/summary"),
    enabled: isLoaded && Boolean(isSignedIn) && canView,
  })
}

export function useSurveys(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") searchParams.set(key, String(value))
  })
  const qs = searchParams.toString()

  return useQuery({
    queryKey: ["surveys", params],
    queryFn: () => apiGetPaginated<SurveyListItem>(`/surveys?${qs}`),
  })
}

export function useSurvey(id: string) {
  return useQuery({
    queryKey: ["surveys", id],
    queryFn: () => apiGet<SurveyListItem & Record<string, unknown>>(`/surveys/${id}`),
    enabled: Boolean(id),
  })
}

export function useWardCommandStats(params: Record<string, string | number | undefined> = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") searchParams.set(key, String(value))
  })
  const qs = searchParams.toString()

  return useQuery({
    queryKey: ["surveys", "ward-stats", params],
    queryFn: () => apiGet<WardCommandStat[]>(`/surveys/ward-stats${qs ? `?${qs}` : ""}`),
  })
}

export function useSurveyMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["surveys"] })
    void qc.invalidateQueries({ queryKey: ["dashboard"] })
  }

  return {
    create: useMutation({
      mutationFn: (body: Record<string, unknown>) => apiPost("/surveys", body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => apiPatch(`/surveys/${id}`, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => apiDelete(`/surveys/${id}`),
      onSuccess: invalidate,
    }),
    submit: useMutation({
      mutationFn: (id: string) => apiPost(`/surveys/${id}/submit`),
      onSuccess: invalidate,
    }),
    approve: useMutation({
      mutationFn: (id: string) => apiPost(`/surveys/${id}/approve`),
      onSuccess: invalidate,
    }),
    reject: useMutation({
      mutationFn: ({ id, qcRemarks }: { id: string; qcRemarks: string }) =>
        apiPost(`/surveys/${id}/reject`, { qcRemarks }),
      onSuccess: invalidate,
    }),
    reopen: useMutation({
      mutationFn: (id: string) => apiPost(`/surveys/${id}/reopen`),
      onSuccess: invalidate,
    }),
    assign: useMutation({
      mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string }) =>
        apiPost(`/surveys/${id}/assign`, { assigneeId }),
      onSuccess: invalidate,
    }),
    bulkApprove: useMutation({
      mutationFn: (ids: string[]) => apiPost<BulkActionResult>("/surveys/bulk/approve", { ids }),
      onSuccess: invalidate,
    }),
    bulkReject: useMutation({
      mutationFn: ({ ids, qcRemarks }: { ids: string[]; qcRemarks: string }) =>
        apiPost<BulkActionResult>("/surveys/bulk/reject", { ids, qcRemarks }),
      onSuccess: invalidate,
    }),
    bulkExport: useMutation({
      mutationFn: (selectedIds: string[]) =>
        apiPost<BulkExportResult>("/surveys/bulk/export", { selectedIds, reportType: "survey_data" }),
    }),
  }
}

export function useSavedViews(entity = "surveys") {
  return useQuery({
    queryKey: ["saved-views", entity],
    queryFn: () => apiGet<SavedView[]>(`/saved-views?entity=${entity}`),
  })
}

export function useSavedViewMutations() {
  const qc = useQueryClient()
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["saved-views"] })

  return {
    create: useMutation({
      mutationFn: (body: {
        name: string
        entity?: string
        filters: Record<string, unknown>
        columns?: Record<string, boolean>
        sortBy?: string
        sortOrder?: "asc" | "desc"
        isDefault?: boolean
      }) => apiPost<SavedView>("/saved-views", body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        body,
      }: {
        id: string
        body: Partial<{
          name: string
          filters: Record<string, unknown>
          columns: Record<string, boolean>
          sortBy: string
          sortOrder: "asc" | "desc"
          isDefault: boolean
        }>
      }) => apiPatch<SavedView>(`/saved-views/${id}`, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => apiDelete(`/saved-views/${id}`),
      onSuccess: invalidate,
    }),
  }
}

export function useStates(params?: { page?: number; limit?: number; search?: string }) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set("page", String(params.page))
  if (params?.limit) qs.set("limit", String(params.limit))
  if (params?.search) qs.set("search", params.search)

  return useQuery({
    queryKey: ["states", params],
    queryFn: () => apiGetPaginated<GeoState>(`/states?${qs}`),
  })
}

export function useDistricts(stateId?: string) {
  return useQuery({
    queryKey: ["districts", stateId],
    queryFn: () => apiGetPaginated<GeoDistrict>(`/districts?stateId=${stateId}&limit=100`),
    enabled: Boolean(stateId),
  })
}

export function useUlbs(districtId?: string) {
  return useQuery({
    queryKey: ["ulbs", districtId],
    queryFn: () => apiGetPaginated<GeoUlb>(`/ulbs?districtId=${districtId}&limit=100`),
    enabled: Boolean(districtId),
  })
}

export function useWards(ulbId?: string) {
  return useQuery({
    queryKey: ["wards", ulbId],
    queryFn: () => apiGetPaginated<GeoWard>(`/wards?ulbId=${ulbId}&limit=200`),
    enabled: Boolean(ulbId),
  })
}

export function useNotifications(page = 1) {
  const { isLoaded, isSignedIn } = useAuth()
  const profile = useAuthStore((s) => s.profile)
  const hasAnyRole = Boolean(profile && profile.permissions.length > 0)

  return useQuery({
    queryKey: ["notifications", page],
    queryFn: () => apiGetPaginated<NotificationItem>(`/notifications?page=${page}&limit=10`),
    enabled: isLoaded && Boolean(isSignedIn) && hasAnyRole,
  })
}

export function useUsers(params: Record<string, string | number | undefined> = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") searchParams.set(key, String(value))
  })
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("user:view")
  const enabled = Object.keys(params).length > 0 && canView

  return useQuery({
    queryKey: ["users", params],
    queryFn: () => apiGetPaginated<AuthenticatedProfile>(`/users?${searchParams}`),
    enabled,
  })
}

export function useReports(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") searchParams.set(key, String(value))
  })

  return useQuery({
    queryKey: ["reports", params],
    queryFn: () => apiGetPaginated<SurveyListItem>(`/reports/surveys?${searchParams}`),
  })
}

export async function exportReport(format: "xlsx" | "csv" | "pdf", params: Record<string, string>) {
  const searchParams = new URLSearchParams({ ...params, format })
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
  return `${base}/reports/export?${searchParams}`
}

export function useImportJobs() {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canImport = hasPermission("survey:create")

  return useQuery({
    queryKey: ["imports", "jobs"],
    queryFn: () => apiGet<ImportJob[]>("/imports/jobs?take=20"),
    enabled: isLoaded && Boolean(isSignedIn) && canImport,
    refetchInterval: (query) => {
      const jobs = query.state.data
      if (!jobs?.length) return false
      const active = jobs.some((job) => job.status === "QUEUED" || job.status === "PROCESSING")
      return active ? 2000 : false
    },
  })
}

export function useImportJob(jobId: string | null) {
  return useQuery({
    queryKey: ["imports", "jobs", jobId],
    queryFn: () => apiGet<ImportJob>(`/imports/jobs/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === "QUEUED" || status === "PROCESSING") return 2000
      return false
    },
  })
}

export function useImportSurveys() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return apiUpload<ImportEnqueueResult>("/imports/surveys", formData)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["imports", "jobs"] })
      void qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export type { PaginatedResult }
