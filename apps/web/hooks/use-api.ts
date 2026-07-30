"use client"

import {
  apiClient,
  apiDelete,
  apiGet,
  apiGetPaginated,
  apiPatch,
  apiPost,
  apiPut,
  apiUpload,
  apiUploadPut,
} from "@/lib/api/client"
import type {
  AuthenticatedProfile,
  BulkActionResult,
  BulkExportResult,
  CatalogPermission,
  CatalogRole,
  ClerkUserSyncSummary,
  CommandCenterFilters,
  CommandCenterKpis,
  CommandCenterWard,
  DashboardAnalytics,
  DashboardOrganization,
  DashboardSummary,
  GeoDistrict,
  GeoState,
  GeoUlb,
  GeoWard,
  ImportEnqueueResult,
  ImportJob,
  ImportPreviewResult,
  NotificationItem,
  PaginatedResult,
  QcCommandCenterFilters,
  QcMetrics,
  QcQueueNeighbors,
  QcQueueParcel,
  QcRegistryFilters,
  QcRegistryResponse,
  QcSurveyActionPayload,
  QcSurveyDetail,
  QcWard,
  ReassignDraftsPayload,
  ReassignDraftsResult,
  RegistryDraftSource,
  RegistryImportResult,
  SavedView,
  SecurityAuditItem,
  SurveyAuditHistoryItem,
  SurveyDetails,
  SurveyListItem,
  SurveyRegistryFilters,
  SurveyRegistryResponse,
  UserDirectoryStats,
  UserImportResult,
  WardCommandStat,
} from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { useAuth } from "@clerk/nextjs"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

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

export function useOrganizationOverview() {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("dashboard:view")

  return useQuery({
    queryKey: ["dashboard", "organization"],
    queryFn: () => apiGet<DashboardOrganization>("/dashboard/organization"),
    enabled: isLoaded && Boolean(isSignedIn) && canView,
  })
}

export function useProductivityAnalytics() {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("dashboard:view")

  return useQuery({
    queryKey: ["dashboard", "analytics"],
    queryFn: () => apiGet<DashboardAnalytics>("/dashboard/analytics"),
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
  return useSurveyDetails(id)
}

export function useSurveyDetails(propertyId: string, enabled = true) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("survey:view")

  return useQuery({
    queryKey: ["surveys", "details", propertyId],
    queryFn: () => apiGet<SurveyDetails>(`/surveys/${propertyId}`),
    enabled: isLoaded && Boolean(isSignedIn) && canView && Boolean(propertyId) && enabled,
  })
}

export function useSurveyAuditHistory(propertyId: string, enabled = true) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("survey:view")

  return useQuery({
    queryKey: ["surveys", "audit-history", propertyId],
    queryFn: () => apiGet<SurveyAuditHistoryItem[]>(`/surveys/${propertyId}/audit-history`),
    enabled: isLoaded && Boolean(isSignedIn) && canView && Boolean(propertyId) && enabled,
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

function toCommandCenterQuery(filters: CommandCenterFilters): string {
  const searchParams = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "any") searchParams.set(key, String(value))
  })
  const qs = searchParams.toString()
  return qs ? `?${qs}` : ""
}

export function useCommandCenterKPIs(filters: CommandCenterFilters, enabled = true) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("survey:view")

  return useQuery({
    queryKey: ["command-center", "kpis", filters],
    queryFn: () => apiGet<CommandCenterKpis>(`/command-center/kpis${toCommandCenterQuery(filters)}`),
    enabled: isLoaded && Boolean(isSignedIn) && canView && enabled,
  })
}

export function useWardWiseData(filters: CommandCenterFilters, enabled = true) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("survey:view")

  return useQuery({
    queryKey: ["command-center", "wards", filters],
    queryFn: () => apiGet<CommandCenterWard[]>(`/command-center/wards${toCommandCenterQuery(filters)}`),
    enabled: isLoaded && Boolean(isSignedIn) && canView && enabled,
  })
}

function toQcQuery(filters: QcCommandCenterFilters): string {
  const searchParams = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "any") searchParams.set(key, String(value))
  })
  const qs = searchParams.toString()
  return qs ? `?${qs}` : ""
}

export function useQcMetrics(filters: QcCommandCenterFilters, enabled = true) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canApprove = hasPermission("survey:approve")

  return useQuery({
    queryKey: ["qc", "metrics", filters],
    queryFn: () => apiGet<QcMetrics>(`/qc/metrics${toQcQuery(filters)}`),
    enabled: isLoaded && Boolean(isSignedIn) && canApprove && enabled,
  })
}

export function useQcWards(filters: QcCommandCenterFilters, enabled = true) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canApprove = hasPermission("survey:approve")

  return useQuery({
    queryKey: ["qc", "wards", filters],
    queryFn: () => apiGet<QcWard[]>(`/qc/wards${toQcQuery(filters)}`),
    enabled: isLoaded && Boolean(isSignedIn) && canApprove && enabled,
  })
}

function toQcRegistryQuery(filters: QcRegistryFilters): string {
  const searchParams = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === "") return
    // Always send status (including "all") — backend defaults to pendingApproved when omitted
    searchParams.set(key, String(value))
  })
  const qs = searchParams.toString()
  return qs ? `?${qs}` : ""
}

export function useQcRegistry(filters: QcRegistryFilters, enabled = true) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canApprove = hasPermission("survey:approve")

  return useQuery({
    queryKey: ["qc", "registry", filters],
    queryFn: () => apiGet<QcRegistryResponse>(`/qc/registry${toQcRegistryQuery(filters)}`),
    enabled: isLoaded && Boolean(isSignedIn) && canApprove && enabled,
  })
}

export function useQcQueueFirst(wardId: string | null | undefined, enabled = true) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canApprove = hasPermission("survey:approve")

  return useQuery({
    queryKey: ["qc", "queue", "first", wardId],
    queryFn: () => apiGet<QcQueueParcel | null>(`/qc/queue/first?wardId=${encodeURIComponent(wardId!)}`),
    enabled: isLoaded && Boolean(isSignedIn) && canApprove && Boolean(wardId) && enabled,
  })
}

export function useQcQueueNeighbors(
  wardId: string | null | undefined,
  surveyId: string | null | undefined,
  enabled = true
) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canApprove = hasPermission("survey:approve")

  return useQuery({
    queryKey: ["qc", "queue", "neighbors", wardId, surveyId],
    queryFn: () =>
      apiGet<QcQueueNeighbors>(
        `/qc/queue/neighbors?wardId=${encodeURIComponent(wardId!)}&surveyId=${encodeURIComponent(surveyId!)}`
      ),
    enabled: isLoaded && Boolean(isSignedIn) && canApprove && Boolean(wardId) && Boolean(surveyId) && enabled,
  })
}

export function useQcSurveyDetail(id: string, enabled = true) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canApprove = hasPermission("survey:approve")

  return useQuery({
    queryKey: ["qc", "survey", id],
    queryFn: () => apiGet<QcSurveyDetail>(`/qc/survey/${encodeURIComponent(id)}`),
    enabled: isLoaded && Boolean(isSignedIn) && canApprove && Boolean(id) && enabled,
    staleTime: 60_000,
  })
}

export function useQcSurveyAuditHistory(id: string, enabled = true) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canApprove = hasPermission("survey:approve")

  return useQuery({
    queryKey: ["qc", "survey", id, "audits"],
    queryFn: () => apiGet<SurveyAuditHistoryItem[]>(`/qc/survey/${encodeURIComponent(id)}/audit-history`),
    enabled: isLoaded && Boolean(isSignedIn) && canApprove && Boolean(id) && enabled,
    staleTime: 60_000,
  })
}

export function useQcSurveyActions() {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["qc"] })
    void qc.invalidateQueries({ queryKey: ["surveys"] })
    void qc.invalidateQueries({ queryKey: ["dashboard"] })
  }

  const runAction = (id: string, payload: QcSurveyActionPayload) =>
    apiPost<QcSurveyDetail | Record<string, unknown>>(`/qc/survey/${encodeURIComponent(id)}/action`, payload)

  return {
    reopen: useMutation({
      mutationFn: (id: string) => runAction(id, { action: "reopen" }),
      onSuccess: invalidate,
    }),
    approve: useMutation({
      mutationFn: (id: string) => runAction(id, { action: "approve" }),
      onSuccess: invalidate,
    }),
    reject: useMutation({
      mutationFn: ({ id, qcRemarks }: { id: string; qcRemarks: string }) =>
        runAction(id, { action: "reject", qcRemarks }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => runAction(id, { action: "delete" }),
      onSuccess: invalidate,
    }),
    correct: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: NonNullable<QcSurveyActionPayload["patch"]> }) =>
        runAction(id, { action: "correct", patch }),
      onSuccess: (data, variables) => {
        if (data && typeof data === "object" && "id" in data && "propertyId" in data) {
          qc.setQueryData(["qc", "survey", variables.id], data)
        }
        invalidate()
      },
    }),
  }
}

function toRegistryQuery(filters: SurveyRegistryFilters): string {
  const searchParams = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") searchParams.set(key, String(value))
  })
  const qs = searchParams.toString()
  return qs ? `?${qs}` : ""
}

export function useRegistryData(filters: SurveyRegistryFilters, enabled = true) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("survey:view")

  return useQuery({
    queryKey: ["survey-registry", filters],
    queryFn: () => apiGet<SurveyRegistryResponse>(`/survey-registry${toRegistryQuery(filters)}`),
    enabled: isLoaded && Boolean(isSignedIn) && canView && enabled,
  })
}

export function useRegistryDraftSources(
  filters: Pick<SurveyRegistryFilters, "districtId" | "ulbId" | "wardId"> & { orphaned?: boolean },
  enabled = true
) {
  const { isLoaded, isSignedIn } = useAuth()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canAssign = hasPermission("survey:assign")

  const searchParams = new URLSearchParams()
  if (filters.districtId) searchParams.set("districtId", filters.districtId)
  if (filters.ulbId) searchParams.set("ulbId", filters.ulbId)
  if (filters.wardId) searchParams.set("wardId", filters.wardId)
  if (filters.orphaned) searchParams.set("orphaned", "true")
  const qs = searchParams.toString()

  return useQuery({
    queryKey: ["survey-registry", "draft-sources", filters],
    queryFn: () => apiGet<RegistryDraftSource[]>(`/survey-registry/draft-sources${qs ? `?${qs}` : ""}`),
    enabled: isLoaded && Boolean(isSignedIn) && canAssign && enabled,
  })
}

export function useReassignDraftsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ReassignDraftsPayload) => apiPost<ReassignDraftsResult>("/survey-registry/reassign", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["survey-registry"] })
      void qc.invalidateQueries({ queryKey: ["surveys"] })
    },
  })
}

export function useRegistryImportMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return apiUpload<RegistryImportResult>("/survey-registry/import", formData)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["survey-registry"] })
      void qc.invalidateQueries({ queryKey: ["imports"] })
    },
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
    queryFn: () => apiGetPaginated<GeoWard>(`/wards?ulbId=${ulbId}&limit=100`),
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

export function useUsers(params: Record<string, string | number | boolean | undefined> = {}) {
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
    placeholderData: keepPreviousData,
  })
}

export function useUserStats() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("user:view")

  return useQuery({
    queryKey: ["users", "stats"],
    queryFn: () => apiGet<UserDirectoryStats>("/users/stats"),
    enabled: canView,
  })
}

export function useRoles() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("user:view") || hasPermission("role:assign")

  return useQuery({
    queryKey: ["roles"],
    queryFn: () => apiGetPaginated<CatalogRole>("/roles?limit=100"),
    enabled: canView,
  })
}

export function useRole(roleId?: string | null) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("user:view") || hasPermission("role:assign")

  return useQuery({
    queryKey: ["roles", roleId],
    queryFn: () => apiGet<CatalogRole>(`/roles/${roleId}`),
    enabled: Boolean(roleId) && canView,
  })
}

export function useRoleAudits(roleId?: string | null) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("user:view") || hasPermission("role:assign")

  return useQuery({
    queryKey: ["roles", roleId, "audits"],
    queryFn: () => apiGet<SecurityAuditItem[]>(`/roles/${roleId}/audits`),
    enabled: Boolean(roleId) && canView,
  })
}

export function usePermissionsCatalog() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("user:view") || hasPermission("role:assign")

  return useQuery({
    queryKey: ["permissions"],
    queryFn: () => apiGetPaginated<CatalogPermission>("/permissions?page=1&limit=100"),
    enabled: canView,
    staleTime: 60_000,
  })
}

export function useUserAudits(userId?: string) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("user:view")

  return useQuery({
    queryKey: ["users", userId, "audits"],
    queryFn: () => apiGet<SecurityAuditItem[]>(`/users/${userId}/audits`),
    enabled: Boolean(userId) && canView,
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: { fullName?: string; phone?: string | null; isActive?: boolean }
    }) => apiPatch<AuthenticatedProfile>(`/users/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/users/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] })
      void queryClient.invalidateQueries({ queryKey: ["users", "stats"] })
    },
  })
}

export function useSyncUsersFromClerk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<ClerkUserSyncSummary>("/users/sync-from-clerk"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })
}

export function useImportUsers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, dryRun }: { file: File; dryRun: boolean }) => {
      const formData = new FormData()
      formData.append("file", file)
      return apiUpload<UserImportResult>(`/users/import${dryRun ? "?dryRun=true" : ""}`, formData)
    },
    onSuccess: (_data, variables) => {
      if (!variables.dryRun) {
        void queryClient.invalidateQueries({ queryKey: ["users"] })
      }
    },
  })
}

export async function downloadUsersImportTemplate(): Promise<void> {
  const response = await apiClient.get("/users/import/template", { responseType: "blob" })
  const blob = response.data as Blob
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "users-import-template.csv"
  anchor.click()
  URL.revokeObjectURL(url)
}

export function useAssignTenantRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      userId: string
      roleId: string
      allotments?: Array<{
        stateId: string
        districtId: string
        ulbId: string
        wardId: string
      }>
      stateId?: string
      districtId?: string
      ulbId?: string
      wardId?: string
    }) => apiPost("/users/tenant-roles/assign", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })
}

export function useDeactivateTenantRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assignmentId: string) => apiDelete(`/users/tenant-roles/${assignmentId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })
}

export function useSetRolePermissions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      apiPut<CatalogRole>(`/roles/${roleId}/permissions`, { permissionIds }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData<CatalogRole>(["roles", variables.roleId], data)
      void queryClient.invalidateQueries({ queryKey: ["roles"] })
      void queryClient.invalidateQueries({ queryKey: ["roles", variables.roleId, "audits"] })
    },
  })
}

export function useRoleUsers(roleId?: string) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("user:view")

  return useQuery({
    queryKey: ["roles", roleId, "users"],
    queryFn: () =>
      apiGet<
        Array<{
          id: string
          user: {
            id: string
            fullName: string
            email: string
            phone?: string | null
            isActive: boolean
            lastLoginAt?: string | null
          }
          state?: { name: string } | null
          district?: { name: string } | null
          ulb?: { name: string } | null
          ward?: { wardNumber: string; wardName: string } | null
        }>
      >(`/roles/${roleId}/users`),
    enabled: Boolean(roleId) && canView,
  })
}

export function useCreateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) => apiPost<CatalogRole>("/roles", body),
    onSuccess: (data) => {
      queryClient.setQueryData<CatalogRole>(["roles", data.id], {
        ...data,
        permissions: data.permissions ?? [],
        permissionCount: data.permissionCount ?? 0,
        assignedUsersCount: data.assignedUsersCount ?? 0,
      })
      void queryClient.invalidateQueries({ queryKey: ["roles"] })
    },
  })
}

export function useUpdateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; description?: string } }) =>
      apiPatch<CatalogRole>(`/roles/${id}`, body),
    onSuccess: (data, variables) => {
      queryClient.setQueryData<CatalogRole>(["roles", variables.id], (prev) => (prev ? { ...prev, ...data } : data))
      void queryClient.invalidateQueries({ queryKey: ["roles"] })
    },
  })
}

export function useCloneRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name: string; description?: string } }) =>
      apiPost<CatalogRole>(`/roles/${id}/clone`, body),
    onSuccess: (data) => {
      queryClient.setQueryData<CatalogRole>(["roles", data.id], data)
      void queryClient.invalidateQueries({ queryKey: ["roles"] })
    },
  })
}

export function useDeleteRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/roles/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] })
    },
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
      void qc.invalidateQueries({ queryKey: ["survey-registry"] })
      void qc.invalidateQueries({ queryKey: ["surveys"] })
    },
  })
}

export function useImportSurveysPreview() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return apiUpload<ImportPreviewResult>("/imports/surveys/preview", formData)
    },
  })
}

export function usePhotoMutations(surveyId: string) {
  const qc = useQueryClient()

  const invalidateSurvey = () => {
    void qc.invalidateQueries({ queryKey: ["qc", "survey", surveyId] })
    void qc.invalidateQueries({ queryKey: ["surveys", surveyId] })
  }

  const upload = useMutation({
    mutationFn: ({ file, photoType }: { file: File; photoType: string }) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("surveyId", surveyId)
      formData.append("photoType", photoType)
      return apiUpload<{ id: string; photoType: string; url: string }>("/photos/upload", formData)
    },
    onSuccess: invalidateSurvey,
  })

  const replace = useMutation({
    mutationFn: ({ id, file, photoType }: { id: string; file: File; photoType?: string }) => {
      const formData = new FormData()
      formData.append("file", file)
      if (photoType) formData.append("photoType", photoType)
      return apiUploadPut<{ id: string; url: string }>(`/photos/${encodeURIComponent(id)}/replace`, formData)
    },
    onSuccess: invalidateSurvey,
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/photos/${encodeURIComponent(id)}`),
    onSuccess: invalidateSurvey,
  })

  const getDownloadUrl = useMutation({
    mutationFn: (id: string) =>
      apiGet<{ photoId: string; url: string; expiresInSeconds: number }>(`/photos/${encodeURIComponent(id)}/download`),
  })

  return { upload, replace, remove, getDownloadUrl }
}

export function useFloorMutations(surveyId: string) {
  const qc = useQueryClient()

  const invalidateSurvey = () => {
    void qc.invalidateQueries({ queryKey: ["qc", "survey", surveyId] })
    void qc.invalidateQueries({ queryKey: ["surveys", surveyId] })
  }

  const create = useMutation({
    mutationFn: (body: {
      floorPosition: string
      usageType?: string | null
      usageFactor?: string | null
      constructionType?: string | null
      areaSqFt?: number | null
    }) =>
      apiPost(`/floors`, {
        surveyId,
        floorPosition: body.floorPosition,
        usageType: body.usageType ?? undefined,
        usageFactor: body.usageFactor ?? undefined,
        constructionType: body.constructionType ?? undefined,
        areaSqFt: body.areaSqFt ?? undefined,
      }),
    onSuccess: invalidateSurvey,
  })

  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: {
        floorPosition?: string
        usageType?: string | null
        usageFactor?: string | null
        constructionType?: string | null
        areaSqFt?: number | null
      }
    }) => apiPatch(`/floors/${encodeURIComponent(id)}`, body),
    onSuccess: invalidateSurvey,
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/floors/${encodeURIComponent(id)}`),
    onSuccess: invalidateSurvey,
  })

  return { create, update, remove }
}

export type { PaginatedResult }
