export const JOB_QUEUE_NAMES = {
  imports: "imports",
  exports: "exports",
  storageCleanup: "storage-cleanup",
} as const

export const JOB_NAMES = {
  processImport: "process-import",
  processExport: "process-export",
  deleteObjects: "delete-objects",
} as const

export type JobQueueName = (typeof JOB_QUEUE_NAMES)[keyof typeof JOB_QUEUE_NAMES]

export type ExportFormat = "json" | "xlsx" | "csv" | "pdf"
export type ExportReportType = "surveys" | "ward" | "ulb" | "district" | "summary"

export interface TenantRolePayload {
  id: string
  roleId: string
  roleName: string
  permissions: string[]
  stateId: string | null
  districtId: string | null
  ulbId: string | null
  wardId: string | null
  isActive: boolean
}

export interface ExportFiltersPayload {
  surveyStatus?: string
  stateId?: string
  districtId?: string
  ulbId?: string
  wardId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

export interface StoredObjectRef {
  bucket?: string
  objectKey: string
  storageProvider?: "S3" | "MINIO"
}

export interface ImportJobPayload extends StoredObjectRef {
  jobId: string
  createdById: string
  originalName: string
  mimeType?: string
  sizeBytes: number
  tenantRoles: TenantRolePayload[]
}

export interface ExportJobPayload {
  jobId: string
  createdById: string
  format: ExportFormat
  reportType: ExportReportType
  filters: ExportFiltersPayload
  tenantRoles: TenantRolePayload[]
}

export interface StorageCleanupPayload {
  objectKeys: string[]
  bucket?: string
  reason?: string
}
