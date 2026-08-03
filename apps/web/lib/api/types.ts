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
  state?: { id: string; name: string; code?: string } | null
  district?: { id: string; name: string } | null
  ulb?: { id: string; name: string; code?: string } | null
  ward?: { id: string; wardNumber: string; wardName: string } | null
}

export const ROLE_LABELS: Record<string, string> = {
  PENDING_APPROVAL: "Pending User",
  SURVEYOR: "Surveyor",
  FIELD_SUPERVISOR: "Supervisor",
  QC_SUPERVISOR: "QC Supervisor",
  ADMIN: "Admin",
  DEPT_ADMIN: "Admin",
  DEPT_CLERK: "Clerk",
  DEPT_OPERATOR: "Operator",
}

/** Platform (SDV) roles assignable by global admins */
export const PLATFORM_ASSIGNABLE_ROLES = [
  "PENDING_APPROVAL",
  "SURVEYOR",
  "FIELD_SUPERVISOR",
  "QC_SUPERVISOR",
  "ADMIN",
] as const

/** Municipal department roles (ULB-scoped) */
export const DEPARTMENT_ASSIGNABLE_ROLES = ["DEPT_ADMIN", "DEPT_CLERK", "DEPT_OPERATOR"] as const

export const ASSIGNABLE_ROLES = [...PLATFORM_ASSIGNABLE_ROLES, ...DEPARTMENT_ASSIGNABLE_ROLES] as const

export type AssignableRoleName = (typeof ASSIGNABLE_ROLES)[number]
export type DepartmentRoleName = (typeof DEPARTMENT_ASSIGNABLE_ROLES)[number]

export function isDepartmentRoleName(roleName: string): boolean {
  return (DEPARTMENT_ASSIGNABLE_ROLES as readonly string[]).includes(roleName)
}

export function tenantRoleCode(role: TenantRole): string {
  return role.role?.name ?? role.roleName ?? "UNKNOWN"
}

export function tenantRoleDisplayName(role: TenantRole): string {
  const code = tenantRoleCode(role)
  return ROLE_LABELS[code] ?? code
}

export function roleDisplayName(roleName: string): string {
  return ROLE_LABELS[roleName] ?? roleName
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

export interface UserDirectoryStats {
  total: number
  active: number
  disabled: number
  pending: number
  surveyors: number
  supervisors: number
  qcSupervisors: number
  admins: number
  deptAdmins?: number
  deptClerks?: number
  deptOperators?: number
  /** Distinct ULBs on active field-role allotments */
  locationsAssigned?: number
  byRole: Record<string, number>
}

export interface CatalogRole {
  id: string
  name: string
  description?: string | null
  family?: "PLATFORM" | "DEPARTMENT"
  createdAt?: string
  updatedAt?: string
  permissionCount?: number
  assignedUsersCount?: number
  permissions?: Array<{
    permissionId?: string
    permission?: { id: string; name: string; description?: string | null } | null
  }>
}

export interface CatalogPermission {
  id: string
  name: string
  description?: string | null
}

export interface SecurityAuditItem {
  id: string
  action: string
  actorId: string
  targetType: string
  targetId?: string | null
  oldValue?: unknown
  newValue?: unknown
  createdAt: string
  actor?: { id: string; fullName: string; email: string }
}

export interface ClerkUserSyncSummary {
  created: number
  updated: number
  skipped: number
  errors: Array<{ clerkUserId?: string; email?: string; message: string }>
  totalFetched: number
}

export interface UserImportRowPreview {
  rowNumber: number
  email: string
  clerkUserId?: string
  fullName?: string
  phone?: string
  roleName?: string
  status: "ok" | "warn" | "error"
  action: "create" | "update" | "skip"
  message: string
  warnings: string[]
}

export interface UserImportResult {
  dryRun: boolean
  created: number
  updated: number
  skipped: number
  errors: number
  rows: UserImportRowPreview[]
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
  /** Field drafts, including surveys reopened for rework */
  draft: number
  /** Submitted and awaiting QC verification */
  submitted: number
  qcApproved: number
  /** Alias for completed/approved metric */
  completed?: number
  /** Returned by QC, not yet reopened */
  returned?: number
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

export interface QcCommandCenterFilters {
  districtId?: string
  ulbId?: string
  wardId?: string
  dateFrom?: string
  dateTo?: string
  month?: string
}

export interface QcMetrics {
  pipeline: {
    pending: number
    inReview: number
    approved: number
    returned: number
  }
  pendingQc: number
  pendingQcRemaining: number
  submittedTotal: number
  approvedQc: number
  queueTotal: number
  qcProgressPct: number
  fieldDrafts: number
  draftsSubmittedToday: number
}

export interface QcWard {
  wardId: string
  wardName: string
  wardNumber: string
  label: string
  totalProperty: number
  fieldDrafts: number
  qcPending: number
  qcApproved: number
  /** Returned by QC, awaiting surveyor rework */
  qcReturned?: number
  /** Reopened by the surveyor and back in the field */
  fieldRework?: number
  /** Alias of qcPending — drives the "Start QC" queue count */
  pending: number
}

export type QcPipelineStage = "pending" | "inReview" | "approved" | "returned"

export type QcRegistryTab = "pendingApproved" | "pendingQc" | "approved" | "returned" | "parcelShared" | "all"

export interface QcRegistryRecord {
  id: string
  propertyId: string
  status: string
  surveyStatus: string
  qcStatus?: string | null
  surveyorName: string
  wardNumber: string
  parcelNumber: string
  propertyUse?: string | null
  ownerName: string
  mobile: string
  date: string
  createdAt?: string
}

export interface QcRegistryCounts {
  pendingApproved: number
  pendingQc: number
  approved: number
  returned: number
  parcelShared: number
  all: number
}

export interface QcRegistryScope {
  districtName?: string | null
  ulbName?: string | null
  wardName?: string | null
  label: string
}

export interface QcRegistryResponse extends PaginatedResult<QcRegistryRecord> {
  counts: QcRegistryCounts
  scope: QcRegistryScope | null
}

export interface QcRegistryFilters {
  page?: number
  limit?: number
  search?: string
  searchField?: "all" | "owner" | "parcel" | "propertyId"
  status?: QcRegistryTab
  districtId?: string
  ulbId?: string
  wardId?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export interface QcQueueParcel {
  id: string
  parcelNumber: string | null
}

export interface QcQueueNeighbors {
  prevId: string | null
  nextId: string | null
  parcelNumber: string | null
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
  importStatus?: string | null
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
  stateName?: string
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

export interface QcSurveyFloorEditable {
  id: string
  floorPosition: string
  usageType: string | null
  usageFactor: string | null
  constructionType: string | null
  areaSqFt: number | null
  position: number
}

export interface QcSurveyCoOwnerEditable {
  id?: string
  name: string
  fatherOrHusbandName: string | null
  mobile: string | null
  alternateMobile: string | null
}

export interface QcSurveyEditable {
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  assignedToId: string | null
  respondentName: string | null
  mobileNumber: string | null
  alternateMobile: string | null
  relationshipWithOwner: string | null
  familySize: number | null
  fatherHusbandName: string | null
  houseDoorNo: string | null
  colony: string | null
  locality: string | null
  city: string | null
  pinCode: string | null
  sectorNo: string | null
  unitSubNo: string | null
  parcelNumber: string | null
  propertyIdOld: string | null
  constructedYear: number | null
  isSlum: boolean
  ownershipType: string | null
  propertyUse: string | null
  propertyType: string | null
  situation: string | null
  roadType: string | null
  taxRateZone: string | null
  assessmentYear: string
  plotAreaSqFt: number | null
  plinthAreaSqFt: number | null
  waterConnection: string | null
  sourceOfWater: string | null
  sanitationType: string | null
  solidWasteCollection: boolean | null
  electricityConsumerNo: string | null
  latitude: number | null
  longitude: number | null
  floors: QcSurveyFloorEditable[]
  coOwners: QcSurveyCoOwnerEditable[]
}

export interface FloorUsageWarning {
  code:
    | "MIXED_USE_PROPERTY_USE_MISMATCH"
    | "FLOOR_AREA_EXCEEDS_PLOT"
    | "FLOOR_AREA_EXCEEDS_PLINTH"
    | "BUILT_UP_MISMATCH"
    | "MISSING_FLOOR_AREA"
    | "USAGE_FACTOR_MIXED_AMBIGUOUS"
  severity: "warning"
  message: string
  floorPosition?: string
  usageFactor?: string
}

export interface QcSurveyDetail extends SurveyDetails {
  editable: QcSurveyEditable
  warnings?: FloorUsageWarning[]
}

export type QcSurveyAction = "reopen" | "approve" | "delete" | "correct" | "reject"

export interface QcSurveyActionPayload {
  action: QcSurveyAction
  qcRemarks?: string
  patch?: Partial<Omit<QcSurveyEditable, "floors" | "coOwners">> & {
    floors?: Array<{
      id?: string
      floorPosition: string
      usageType?: string | null
      usageFactor?: string | null
      constructionType?: string | null
      areaSqFt?: number | null
    }>
    coOwners?: Array<{
      id?: string
      name: string
      fatherOrHusbandName?: string | null
      mobile?: string | null
      alternateMobile?: string | null
    }>
  }
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

export interface ImportPreviewWarning {
  code: string
  message: string
}

export interface ImportPreviewResult {
  originalName: string
  format: "multi-sheet" | "inline-children" | "surveys-only" | "csv"
  surveyRows: number
  coOwnerRows: number
  floorRows: number
  photoRows: number
  missingPropertyIdRows: number
  missingUlbOrWardRows: number
  duplicatePropertyIdCount: number
  duplicateLocalIdCount: number
  usedInlineColumns: boolean
  sheetPreferredWarning: boolean
  canImport: boolean
  warnings: ImportPreviewWarning[]
  sampleErrors: ImportRowError[]
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
  code: string
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
