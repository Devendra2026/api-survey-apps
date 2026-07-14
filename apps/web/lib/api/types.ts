export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T | null
  errors: unknown[] | null
  timestamp: string
  path?: string
  statusCode?: number
}

export interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PaginatedResult<T> {
  items: T[]
  meta: PaginatedMeta
}

export interface TenantRole {
  id: string
  role: { id: string; name: string }
  stateId?: string | null
  districtId?: string | null
  ulbId?: string | null
  wardId?: string | null
  isActive: boolean
}

export interface AppUser {
  id: string
  clerkUserId: string
  email: string
  phone?: string | null
  fullName: string
  isActive: boolean
  lastLoginAt?: string | null
  tenantRoles?: TenantRole[]
}

export interface AuthenticatedProfile extends AppUser {
  permissions: string[]
}

export interface DashboardSummary {
  total: number
  byStatus: Record<string, number>
  recent: Array<{
    id: string
    propertyId: string
    surveyStatus: string
    createdAt: string
    submittedAt?: string | null
  }>
  today: {
    created: number
    submitted: number
    approved: number
  }
  pendingApproval: number
  rejected: number
  byDistrict: Array<{ id: string; name: string; count: number }>
  byUlb: Array<{ id: string; name: string; count: number }>
  byWard: Array<{ id: string; name: string; count: number }>
  monthlyTrend: Array<{ month: string; count: number }>
  topSurveyors: Array<{
    id: string
    fullName: string
    email: string
    count: number
  }>
}

export interface SurveyListItem {
  id: string
  propertyId: string
  surveyStatus: string
  respondentName?: string | null
  locality?: string | null
  createdAt: string
  updatedAt: string
  state?: { id: string; name: string }
  district?: { id: string; name: string }
  ulb?: { id: string; name: string }
  ward?: { id: string; wardName: string; wardNumber: string }
  createdBy?: { id: string; fullName: string }
}

export interface GeoState {
  id: string
  name: string
  code: string
}

export interface GeoDistrict {
  id: string
  name: string
  stateId: string
}

export interface GeoUlb {
  id: string
  name: string
  code: string
  districtId: string
  type: string
}

export interface GeoWard {
  id: string
  wardNumber: string
  wardName: string
  ulbId: string
}

export interface NotificationItem {
  id: string
  type: string
  message: string
  surveyId: string
  propertyId: string
  surveyStatus: string
  changedBy: { id: string; fullName: string; email: string }
  changedAt: string
  isOwnSurvey: boolean
}

export type SurveyStatus = "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REOPENED"
