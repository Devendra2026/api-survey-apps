import type { ConvexSurveyBundle, ListSurveyIdsResult } from "../domain/types.js"
import type { ConvexExtractorPort } from "../ports/ports.js"
import { ConvexEtlHttpError } from "./convex-etl-error.js"
import { fingerprintSecret } from "./secret-fingerprint.js"

export interface ConvexHttpExtractorOptions {
  /** Convex site URL (HTTP actions), e.g. https://xxx.convex.site */
  siteUrl: string
  /** Shared secret sent as X-ETL-Secret */
  etlSecret: string
  fetchImpl?: typeof fetch
}

/**
 * HTTP adapter calling Convex ETL endpoints authenticated with X-ETL-Secret.
 */
export class ConvexHttpExtractor implements ConvexExtractorPort {
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string
  private readonly etlSecret: string

  constructor(options: ConvexHttpExtractorOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.baseUrl = options.siteUrl.trim().replace(/\/+$/, "")
    // Trimmed at the boundary that sends the header: a secret pasted or piped
    // into an env var picks up whitespace that would fail the comparison.
    this.etlSecret = options.etlSecret.trim()
  }

  /** Non-reversible fingerprint of the secret being sent, for preflight diagnostics. */
  async secretFingerprint(): Promise<string> {
    return fingerprintSecret(this.etlSecret)
  }

  async listSurveyIds(input: {
    cursor: string | null
    numItems: number
    status?: string
    statuses?: readonly string[]
  }): Promise<ListSurveyIdsResult> {
    const { statuses, ...rest } = input
    return this.post<ListSurveyIdsResult>("/etl/list-survey-ids", {
      ...rest,
      ...(statuses?.length ? { statuses: [...statuses] } : {}),
    })
  }

  async getSurveyBundles(ids: string[]): Promise<ConvexSurveyBundle[]> {
    const result = await this.post<{ bundles: ConvexSurveyBundle[] }>("/etl/get-survey-bundles", {
      ids,
    })
    return result.bundles
  }

  /** Pass the same statuses used to list, or the delta against Postgres is meaningless. */
  async countSurveys(statuses?: readonly string[]): Promise<number> {
    const result = await this.post<{ count: number }>(
      "/etl/count-surveys",
      statuses?.length ? { statuses: [...statuses] } : {}
    )
    return result.count
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
