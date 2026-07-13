import type { SurveyStatus } from "@workspace/database"

export type ExportFormat = "json" | "xlsx" | "csv" | "pdf"
export type ExportReportType = "surveys" | "ward" | "ulb" | "district" | "summary"

export interface ExportFilters {
  surveyStatus?: SurveyStatus
  stateId?: string
  districtId?: string
  ulbId?: string
  wardId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}
