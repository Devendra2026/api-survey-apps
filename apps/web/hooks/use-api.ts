import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost } from "@/lib/api/client"
import type {
  AuthenticatedProfile,
  DashboardSummary,
  GeoDistrict,
  GeoState,
  GeoUlb,
  GeoWard,
  NotificationItem,
  PaginatedResult,
  SurveyListItem,
} from "@/lib/api/types"
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
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiGet<DashboardSummary>("/dashboard/summary"),
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
  return useQuery({
    queryKey: ["notifications", page],
    queryFn: () => apiGetPaginated<NotificationItem>(`/notifications?page=${page}&limit=10`),
  })
}

export function useUsers(params: Record<string, string | number | undefined> = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") searchParams.set(key, String(value))
  })

  return useQuery({
    queryKey: ["users", params],
    queryFn: () => apiGetPaginated<AuthenticatedProfile>(`/users?${searchParams}`),
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

export type { PaginatedResult }
