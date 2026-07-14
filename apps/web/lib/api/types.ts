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
  /** Nested role from Prisma includes (preferred for /users/me). */
  role?: { id: string; name: string }
  /** Flat name from auth-context assignments (fallback). */
  roleName?: string
  roleId?: string
  stateId?: string | null
  districtId?: string | null
  ulbId?: string | null
  wardId?: string | null
  isActive: boolean
}

export function tenantRoleDisplayName(role: TenantRole): string {
  return role.role?.name ?? role.roleName ?? "Role"
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
  qcStatus: Record<string, number>
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
  byWard: Array<{ id: string; name: string; count: number; byStatus: Record<string, number> }>
  monthlyTrend: Array<{ month: string; count: number }>
  topSurveyors: Array<{
    id: string
    fullName: string
    email: string
    count: number
  }>
  gps: {
    averageAccuracyMeters: number | null
  }
  jobs: {
    imports: Array<{
      id: string
      status: string
      originalName: string
      processedRows: number
      totalRows: number
      createdAt: string
    }>
    exports: Array<{
      id: string
      status: string
      reportType: string
      format: string
      rowCount: number
      createdAt: string
    }>
  }
}

export interface SurveyListItem {
  id: string
  propertyId: string
  surveyStatus: string
  qcStatus?: string
  respondentName?: string | null
  mobileNumber?: string | null
  locality?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  assessmentYear?: string | null
  assignedToId?: string | null
  createdAt: string
  updatedAt: string
  submittedAt?: string | null
  state?: { id: string; name: string }
  district?: { id: string; name: string }
  ulb?: { id: string; name: string }
  ward?: { id: string; wardName: string; wardNumber: string }
  createdBy?: { id: string; fullName: string }
  assignedTo?: { id: string; fullName: string; email?: string } | null
}

export interface WardCommandStat {
  id: string
  name: string
  wardNumber: string | null
  ulbId: string | null
  count: number
  byStatus: Record<string, number>
}

export interface SavedView {
  id: string
  userId: string
  name: string
  entity: string
  filters: Record<string, unknown>
  columns?: Record<string, boolean> | null
  sortBy?: string | null
  sortOrder?: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface BulkActionResult {
  succeeded: string[]
  failed: Array<{ id: string; reason: string }>
}

export interface BulkExportResult {
  jobId: string
  status: string
  selectedCount: number
}

export interface ImportEnqueueResult {
  jobId: string
  status: string
}

export interface ImportRowError {
  row: number
  propertyId?: string
  localId?: string
  errors: string[]
}

export interface ImportJob {
  id: string
  status: string
  originalName: string
  totalRows: number
  processedRows: number
  successCount: number
  failureCount: number
  photoSuccessCount: number
  photoFailureCount: number
  errorMessage?: string | null
  errorReportKey?: string | null
  resultSummary?: {
    totalRows?: number
    successCount?: number
    failureCount?: number
    errors?: ImportRowError[]
  } | null
  startedAt?: string | null
  finishedAt?: string | null
  createdAt: string
  updatedAt: string
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
