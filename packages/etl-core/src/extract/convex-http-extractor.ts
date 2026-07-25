import type { ConvexSurveyBundle, ListSurveyIdsResult } from "../domain/types.js"
import type { ConvexExtractorPort } from "../ports/ports.js"

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

  constructor(private readonly options: ConvexHttpExtractorOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async listSurveyIds(input: {
    cursor: string | null
    numItems: number
    status?: string
  }): Promise<ListSurveyIdsResult> {
    return this.post<ListSurveyIdsResult>("/etl/list-survey-ids", input)
  }

  async getSurveyBundles(ids: string[]): Promise<ConvexSurveyBundle[]> {
    const result = await this.post<{ bundles: ConvexSurveyBundle[] }>("/etl/get-survey-bundles", {
      ids,
    })
    return result.bundles
  }

  async countSurveys(): Promise<number> {
    const result = await this.post<{ count: number }>("/etl/count-surveys", {})
    return result.count
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const base = this.options.siteUrl.replace(/\/$/, "")
    const response = await this.fetchImpl(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ETL-Secret": this.options.etlSecret,
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`Convex ETL ${path} failed (${response.status}): ${text.slice(0, 500)}`)
    }
    return (await response.json()) as T
  }
}
