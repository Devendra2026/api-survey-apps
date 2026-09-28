import type {
  AssessmentYear,
  ConstructionType,
  CursorPage,
  FieldMetrics,
  FloorPosition,
  PhotoType,
  QcStatus,
  SurveyCoOwner,
  SurveyFloor,
  SurveyPatch,
  SurveyPhoto,
  SurveyRecord,
  SurveyStatus,
  UsageFactor,
  UsageType,
  WardOption,
} from "@/features/surveys/types"
import { File } from "expo-file-system"
import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from "./client"

export type SurveyListParams = {
  surveyStatus?: SurveyStatus
  qcStatus?: QcStatus
  wardId?: string
  surveyorId?: string
  search?: string
  cursor?: string | null
  limit?: number
}

function toQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

/** Cursor-paginated, tenant-scoped list (existing `GET /surveys`). */
export function listSurveys(params: SurveyListParams): Promise<CursorPage<SurveyRecord>> {
  return apiGet(
    `/surveys${toQuery({
      cursorPagination: "true",
      sortBy: "createdAt",
      sortOrder: "desc",
      limit: params.limit ?? 20,
      cursor: params.cursor,
      surveyStatus: params.surveyStatus,
      qcStatus: params.qcStatus,
      wardId: params.wardId,
      surveyorId: params.surveyorId,
      search: params.search,
    })}`
  )
}

export function getSurveyRecord(id: string): Promise<SurveyRecord> {
  return apiGet(`/surveys/${encodeURIComponent(id)}/record`)
}

export function getFieldMetrics(scope: "self" | "team", todayStart: string): Promise<FieldMetrics> {
  return apiGet(`/surveys/field-metrics${toQuery({ scope, todayStart })}`)
}

export type CreateSurveyInput = {
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  propertyId: string
  assessmentYear: AssessmentYear
}

export function createSurvey(input: CreateSurveyInput): Promise<SurveyRecord> {
  return apiPost("/surveys", input)
}

export function patchSurvey(id: string, patch: SurveyPatch): Promise<SurveyRecord> {
  return apiPatch(`/surveys/${encodeURIComponent(id)}`, patch)
}

export function submitSurvey(id: string): Promise<SurveyRecord> {
  return apiPost(`/surveys/${encodeURIComponent(id)}/submit`)
}

export function reopenSurvey(id: string): Promise<SurveyRecord> {
  return apiPost(`/surveys/${encodeURIComponent(id)}/reopen`)
}

export type CreateFloorInput = {
  surveyId: string
  floorPosition: FloorPosition
  usageFactor: UsageFactor
  usageType?: UsageType
  constructionType: ConstructionType
  areaSqFt?: number
}

export function createFloor(input: CreateFloorInput): Promise<SurveyFloor> {
  return apiPost("/floors", input)
}

export function deleteFloor(id: string): Promise<unknown> {
  return apiDelete(`/floors/${encodeURIComponent(id)}`)
}

export type CreateCoOwnerInput = {
  surveyId: string
  name: string
  fatherOrHusbandName?: string
  mobile?: string
}

export function createCoOwner(input: CreateCoOwnerInput): Promise<SurveyCoOwner> {
  return apiPost("/coowners", input)
}

export function deleteCoOwner(id: string): Promise<unknown> {
  return apiDelete(`/coowners/${encodeURIComponent(id)}`)
}

export type UploadPhotoInput = {
  surveyId: string
  photoType: PhotoType
  uri: string
  width?: number
  height?: number
  capturedAt: string
}

/** `POST /photos/upload` stores the object in MinIO/S3 and returns the Photo row with its `objectKey`. */
export function uploadSurveyPhoto(input: UploadPhotoInput): Promise<SurveyPhoto> {
  const form = new FormData()
  form.append("file", new File(input.uri))
  form.append("surveyId", input.surveyId)
  form.append("photoType", input.photoType)
  form.append("capturedAt", input.capturedAt)
  if (input.width) form.append("width", String(Math.round(input.width)))
  if (input.height) form.append("height", String(Math.round(input.height)))
  return apiPostForm("/photos/upload", form)
}

export function deleteSurveyPhoto(id: string): Promise<unknown> {
  return apiDelete(`/photos/${encodeURIComponent(id)}`)
}

export function photoFilePath(id: string): string {
  return `/photos/${encodeURIComponent(id)}/file`
}

export function listWards(ulbId: string): Promise<{ items: WardOption[] }> {
  return apiGet(`/wards${toQuery({ ulbId, limit: 100, sortBy: "wardNumber", sortOrder: "asc" })}`)
}
