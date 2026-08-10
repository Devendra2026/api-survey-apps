import { ConvexEtlHttpError, computeBackoffMs } from "@workspace/etl-core"

export interface AuditListPage {
  records: unknown[]
  isDone: boolean
  nextCreationTime: number | null
  nextId: string | null
}

export interface AuditVerifyWindowResponse {
  windowStartMs: number
  windowEndMs: number
  count: number
  checksum: string
}

export interface ConvexAuditExtractorOptions {
  siteUrl: string
  etlSecret: string
  fetchImpl?: typeof fetch
  maxRetries?: number
  retryBaseMs?: number
  retryMaxMs?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * HTTP extractor for Convex audit ETL endpoints with exponential backoff.
 */
export class ConvexAuditExtractor {
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string
  private readonly etlSecret: string
  private readonly maxRetries: number
  private readonly retryBaseMs: number
  private readonly retryMaxMs: number

  constructor(options: ConvexAuditExtractorOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.baseUrl = options.siteUrl.trim().replace(/\/+$/, "")
    this.etlSecret = options.etlSecret.trim()
    this.maxRetries = options.maxRetries ?? 5
    this.retryBaseMs = options.retryBaseMs ?? 1_000
    this.retryMaxMs = options.retryMaxMs ?? 60_000
  }

  async listAuditLogs(input: {
    lastCreationTime: number
    lastId: string
    limit: number
  }): Promise<AuditListPage> {
    const raw = await this.postWithRetry<{
      records: unknown[]
      isDone: boolean
      nextCreationTime: number | null
      nextId: string | null
    }>("/etl/audit/list", input)

    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      isDone: Boolean(raw.isDone),
      nextCreationTime: raw.nextCreationTime ?? null,
      nextId: raw.nextId ?? null,
    }
  }

  async verifyWindow(input: {
    windowStartMs: number
    windowEndMs: number
  }): Promise<AuditVerifyWindowResponse> {
    return this.postWithRetry<AuditVerifyWindowResponse>("/etl/audit/verify-window", input)
  }

  /**
   * Async generator: yields pages from the given cursor until isDone.
   * Does not mutate external cursor state — caller advances after successful load.
   */
  async *streamPages(input: {
    lastCreationTime: number
    lastId: string
    limit: number
  }): AsyncGenerator<AuditListPage, void, undefined> {
    let lastCreationTime = input.lastCreationTime
    let lastId = input.lastId

    for (;;) {
      const page = await this.listAuditLogs({
        lastCreationTime,
        lastId,
        limit: input.limit,
      })
      yield page
      if (page.isDone || page.records.length === 0 || page.nextCreationTime === null || page.nextId === null) {
        return
      }
      lastCreationTime = page.nextCreationTime
      lastId = page.nextId
    }
  }

  private async postWithRetry<T>(path: string, body: unknown): Promise<T> {
    let lastError: unknown
    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.post<T>(path, body)
      } catch (err) {
        lastError = err
        const retryable =
          err instanceof ConvexEtlHttpError ? err.isRetryable : true
        if (!retryable || attempt >= this.maxRetries) {
          throw err
        }
        await sleep(computeBackoffMs(attempt, this.retryBaseMs, this.retryMaxMs))
      }
    }
    throw lastError
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ETL-Secret": this.etlSecret,
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new ConvexEtlHttpError({
        path,
        status: response.status,
        body: text,
        wwwAuthenticate: response.headers.get("www-authenticate") ?? undefined,
      })
    }
    return (await response.json()) as T
  }
}
