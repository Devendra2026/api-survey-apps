export const JOB_QUEUE_NAMES = {
  imports: "imports",
  exports: "exports",
  storageCleanup: "storage-cleanup",
  imageMigration: "image-migration",
  etlSurveyImport: "etl-survey-import",
  etlImageDownload: "etl-image-download",
  etlImageUpload: "etl-image-upload",
  etlValidation: "etl-validation",
  etlRetry: "etl-retry",
  etlReport: "etl-report",
} as const

export const JOB_NAMES = {
  processImport: "process-import",
  processExport: "process-export",
  deleteObjects: "delete-objects",
  migrateImages: "migrate-images",
  importSurveyBatch: "import-survey-batch",
  importSurvey: "import-survey",
  downloadPhoto: "download-photo",
  uploadPhoto: "upload-photo",
  validateJob: "validate-job",
  retryFailed: "retry-failed",
  generateReport: "generate-report",
} as const

export type JobQueueName = (typeof JOB_QUEUE_NAMES)[keyof typeof JOB_QUEUE_NAMES]

export type ExportFormat = "json" | "xlsx" | "csv" | "pdf"

export type ExportReportType =
  | "surveys"
  | "ward"
  | "ulb"
  | "district"
  | "summary"
  | "convex_full"
  | "survey_data"
  | "district_ward_zip"
  | "nagar_panchayat"
  | "qc_final"
  | "demand_notices"

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
  qcStatus?: string
  stateId?: string
  districtId?: string
  ulbId?: string
  wardId?: string
  surveyorId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  selectedIds?: string[]
  assessmentYearId?: string
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
  resumeFromCheckpoint?: boolean
  /** When true, only re-process rows listed in failedPropertyIds / failedLocalIds. */
  retryFailedOnly?: boolean
  failedPropertyIds?: string[]
  failedLocalIds?: string[]
  failedRows?: number[]
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

export interface ImageMigrationPayload {
  importJobId: string
  surveyId: string
  photoId: string
  sourceUrl: string
  photoType: string
  createdById: string
}

export type EtlJobType = "FULL" | "INCREMENTAL" | "RETRY_FAILED" | "VALIDATE" | "REFRESH_PENDING"

export interface EtlSurveyBatchPayload {
  migrationJobId: string
  correlationId: string
  type: EtlJobType
  cursor: string | null
  batchSize: number
  force?: boolean
  createdById?: string
  /** When true, reprocess COMPLETED imports that are still PENDING QC in Nest. */
  refreshPending?: boolean
  districtId?: string
}

export interface EtlSurveyImportPayload {
  migrationJobId: string
  correlationId: string
  legacySurveyId: string
  type: EtlJobType
  createdById?: string
  refreshPending?: boolean
  districtId?: string
}

export interface EtlPhotoPayload {
  migrationJobId: string
  correlationId: string
  legacySurveyId: string
  slot: "front" | "inside" | "side" | "document"
  sourceUrl: string
  objectKey: string
  width?: number
  height?: number
  sizeKb?: number
  capturedAt?: number
}

export interface EtlValidatePayload {
  migrationJobId: string
  correlationId: string
  createdById?: string
}

export interface EtlRetryPayload {
  migrationJobId: string
  correlationId: string
  maxRetries: number
  createdById?: string
}

export interface EtlReportPayload {
  migrationJobId: string
  correlationId: string
}
