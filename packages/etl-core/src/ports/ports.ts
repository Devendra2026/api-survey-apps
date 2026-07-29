import type {
  ConvexSurveyBundle,
  ListSurveyIdsResult,
  MappedSurvey,
} from "../domain/types.js"

export interface ConvexExtractorPort {
  listSurveyIds(input: {
    cursor: string | null
    numItems: number
    status?: string
    statuses?: readonly string[]
  }): Promise<ListSurveyIdsResult>

  getSurveyBundles(ids: string[]): Promise<ConvexSurveyBundle[]>

  countSurveys(statuses?: readonly string[]): Promise<number>
}

export interface ObjectStoragePort {
  putObject(input: {
    key: string
    body: Buffer
    mimeType: string
    metadata?: Record<string, string>
  }): Promise<{ key: string; bucket: string; provider: "S3" | "MINIO"; checksum: string; sizeBytes: number }>

  deleteObject(key: string): Promise<void>
}

export interface MigrationRepositoryPort {
  getStatus(legacySurveyId: string): Promise<string | null>
  markInProgress(legacySurveyId: string, correlationId: string): Promise<void>
  markCompleted(input: {
    legacySurveyId: string
    surveyId: string
    imagesImported: number
    imagesExpected: number
    checksum: string
    correlationId: string
  }): Promise<void>
  markSkipped(legacySurveyId: string, correlationId: string): Promise<void>
  markFailed(legacySurveyId: string, error: string, correlationId: string): Promise<void>
}

export interface SurveyLoadPort {
  /**
   * Inserts survey + children + photos in one transaction.
   * Caller is responsible for uploading images first and compensating on failure.
   */
  loadSurvey(survey: MappedSurvey, photoMeta: Array<{
    slot: string
    photoType: string
    objectKey: string
    sourceUrl: string
    bucket: string
    provider: "S3" | "MINIO"
    mimeType: string
    sizeBytes: number
    checksum: string
    width?: number
    height?: number
    capturedAt?: Date
  }>): Promise<{ surveyId: string }>
}
