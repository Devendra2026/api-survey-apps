import type { SurveyStatus } from "@workspace/database"

export type ExportFormat = "json" | "xlsx" | "csv" | "pdf"
export type ExportReportType =
  "surveys" | "ward" | "ulb" | "district" | "summary" | "convex_full" | "survey_data" | "nagar_panchayat" | "qc_final"

export interface ExportFilters {
  surveyStatus?: SurveyStatus
  qcStatus?: string
  stateId?: string
  districtId?: string
  ulbId?: string
  wardId?: string
  surveyorId?: string
  selectedIds?: string[]
  search?: string
  dateFrom?: string
  dateTo?: string
}
