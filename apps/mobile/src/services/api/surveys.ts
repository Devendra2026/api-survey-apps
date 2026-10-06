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
import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm, apiPutForm } from "./client"

export type SurveyListParams = {
  surveyStatus?: SurveyStatus
  qcStatus?: QcStatus
  wardId?: string
  surveyorId?: string
  search?: string
  /** Inclusive createdAt lower bound (ISO). Matches field-metrics local midnight. */
  dateFrom?: string
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
      dateFrom: params.dateFrom,
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

export function updateFloor(id: string, input: Omit<CreateFloorInput, "surveyId">): Promise<SurveyFloor> {
  return apiPatch(`/floors/${encodeURIComponent(id)}`, input)
}

export function deleteFloor(id: string): Promise<unknown> {
  return apiDelete(`/floors/${encodeURIComponent(id)}`)
}

export type CoOwnerWrite = {
  name: string
  fatherOrHusbandName?: string | null
  mobile?: string | null
  alternateMobile?: string | null
}

export type CreateCoOwnerInput = CoOwnerWrite & {
  surveyId: string
}

export function createCoOwner(input: CreateCoOwnerInput): Promise<SurveyCoOwner> {
  return apiPost("/coowners", input)
}

export function updateCoOwner(id: string, input: CoOwnerWrite): Promise<SurveyCoOwner> {
  return apiPatch(`/coowners/${encodeURIComponent(id)}`, input)
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

function appendPhotoFile(form: FormData, input: UploadPhotoInput, includeSurveyId: boolean): void {
  form.append("file", new File(input.uri))
  if (includeSurveyId) form.append("surveyId", input.surveyId)
  form.append("photoType", input.photoType)
  form.append("capturedAt", input.capturedAt)
  if (input.width) form.append("width", String(Math.round(input.width)))
  if (input.height) form.append("height", String(Math.round(input.height)))
}

/** `POST /photos/upload` stores the object in MinIO/S3 and returns the Photo row with its `objectKey`. */
export function uploadSurveyPhoto(input: UploadPhotoInput): Promise<SurveyPhoto> {
  const form = new FormData()
  appendPhotoFile(form, input, true)
  return apiPostForm("/photos/upload", form)
}

/** `PUT /photos/:id/replace` updates the existing photo row. Use this for retakes. */
export function replaceSurveyPhoto(photoId: string, input: UploadPhotoInput): Promise<SurveyPhoto> {
  const form = new FormData()
  appendPhotoFile(form, input, false)
  return apiPutForm(`/photos/${encodeURIComponent(photoId)}/replace`, form)
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

export type UlbPinCodeItem = {
  id: string
  code: string
}

/** Postal codes registered for a ULB (`GET /ulbs/:id/pin-codes`). */
export function listUlbPinCodes(ulbId: string): Promise<UlbPinCodeItem[]> {
  return apiGet(`/ulbs/${encodeURIComponent(ulbId)}/pin-codes`)
}
