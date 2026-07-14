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
  /** Pro Max top-line stats (from Nest GET /dashboard/summary) */
  totalSurveys: number
  draft: number
  pendingQc: number
  createdToday: number
  createdTodaySubmitted: number
  approvedQc: number
  rejections: number
  rejectionRate: number
  queueHealth: "Backlogged" | "Elevated" | "Healthy"

  /** Legacy operations summary */
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

export interface DashboardOrganization {
  activeSurveyors: number
  activeQcSupervisors: number
  districts: number
  municipalities: number
}

export interface DashboardAnalytics {
  dailyTrend: Array<{
    date: string
    created: number
    approved: number
    rejected: number
  }>
  surveyorProductivity: Array<{
    name: string
    submitted: number
    approved: number
  }>
  qcSupervisors: Array<{
    name: string
    approved: number
    rejected: number
    status?: "High Throughput"
  }>
  municipalities: Array<{
    name: string
    approved: number
    target: number
    percent: number
    accent: "slate" | "amber" | "muted"
  }>
  recentActivity: Array<{
    id: string
    title: string
    actor: string
    timestamp: string
  }>
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

export interface CommandCenterKpis {
  totalProperties: number
  draftSurveys: number
  submittedSurveys: number
  qcApproved: number
  /** Alias for Approved / Completed KPI */
  approvedCompleted?: number
  avgFieldCompletionPct: number
  submittedToday: number
  /** Drafts updated today */
  editedToday?: number
  awaitingQc: number
  returned: number
}

export interface CommandCenterWard {
  wardId: string
  wardName: string
  wardNumber: string
  totalProperties: number
  draft: number
  submitted: number
  qcApproved: number
  /** Alias for completed/approved metric */
  completed?: number
  activeSurveyors: number
}

export interface CommandCenterFilters {
  districtId?: string
  ulbId?: string
  wardId?: string
  surveyStatus?: string
  dateFrom?: string
  dateTo?: string
  month?: string
}

export type SurveyRegistryTab = "all" | "draft" | "submitted" | "qcPending" | "qcApproved" | "rejected"

export interface SurveyRegistryRecord {
  id: string
  status: string
  surveyStatus: string
  qcStatus?: string | null
  progress: number
  surveyorName: string
  surveyorId?: string
  propertyId: string
  wardNumber: string
  parcelNumber: string
  ownerName: string
  surveyDate: string
  createdAt?: string
}

export interface SurveyRegistryCounts {
  all: number
  draft: number
  submitted: number
  qcPending: number
  qcApproved: number
  rejected: number
}

export interface SurveyRegistryScope {
  districtName?: string | null
  ulbName?: string | null
  wardName?: string | null
  label: string
}

export interface SurveyRegistryResponse extends PaginatedResult<SurveyRegistryRecord> {
  counts: SurveyRegistryCounts
  scope: SurveyRegistryScope | null
}

export interface SurveyRegistryFilters {
  page?: number
  limit?: number
  search?: string
  tab?: SurveyRegistryTab
  districtId?: string
  ulbId?: string
  wardId?: string
  surveyorId?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export interface RegistryDraftSource {
  id: string
  fullName: string
  draftCount: number
}

export interface ReassignDraftsPayload {
  fromSurveyorId?: string
  toSurveyorId: string
  scopeId?: string
  districtId?: string
  ulbId?: string
  wardId?: string
}

export interface ReassignDraftsResult {
  success: boolean
  transferred: number
  message: string
}

export interface RegistryImportResult {
  success: boolean
  importedCount: number
  jobId?: string
  message?: string
}

export interface SurveyOwnerRow {
  propertyId: string
  name: string
  fatherHusband: string
  mobile: string
  altMobile: string
}

export interface SurveyFloorRow {
  sNo: number
  floor: string
  usageType: string
  usageFactor: string
  construction: string
  area: string
}

export interface SurveyPhotoItem {
  id: string
  photoType: string
  label: string
  url: string
  capturedAt: string | null
  surveyorName: string
}

export interface SurveyQcRemarkItem {
  id: string
  body: string
  author: string
  createdAt: string
}

export interface SurveyDetails {
  id: string
  propertyId: string
  ulbName: string
  wardNo: string
  parcelNo: string
  ownerName: string
  status: string
  surveyStatus: string
  qcStatus?: string | null
  district: string
  sectorZone: string
  unitSubNo: string
  propertyIdOld: string
  constructedYear: string
  surveyor: string
  slumArea: string
  respondentName: string
  mobileNumber: string
  familySize: number | null
  relationshipWithOwner: string
  altMobile: string
  fatherHusbandName: string
  houseDoorNo: string
  colonySociety: string
  localityLandmark: string
  city: string
  pinCode: string
  coordinates: string
  latitude: number | null
  longitude: number | null
  gpsAccuracyMeters: number | null
  assessmentYear: string
  ownershipType: string
  propertyUse: string
  propertyType: string
  situation: string
  roadType: string
  taxRateZone: string
  plotArea: string
  plinthArea: string
  builtUpArea: string
  waterConnection: string
  sourceOfWater: string
  sanitationType: string
  doorToDoorCollection: string
  electricityConsumerNo: string
  frontPhotoUrl: string | null
  sidePhotoUrl: string | null
  owners: SurveyOwnerRow[]
  floors: SurveyFloorRow[]
  photos: SurveyPhotoItem[]
  qcRemarks: string | null
  qcRemarkItems: SurveyQcRemarkItem[]
}

export interface SurveyAuditHistoryItem {
  propertyId: string
  when: string
  action: string
  actor: string
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
