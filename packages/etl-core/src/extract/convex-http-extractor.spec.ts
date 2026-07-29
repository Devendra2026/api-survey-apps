import { describe, expect, it } from "@jest/globals"
import { CONVEX_SURVEY_STATUSES, ETL_MIGRATABLE_STATUSES } from "../domain/types.js"
import { ConvexHttpExtractor } from "./convex-http-extractor.js"

interface Captured {
  url: string
  body: Record<string, unknown>
}

function extractorWithCapture(payload: unknown) {
  const calls: Captured[] = []
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> })
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
      headers: { get: () => null },
    }
  }) as unknown as typeof fetch

  const extractor = new ConvexHttpExtractor({
    siteUrl: "https://example.convex.site",
    etlSecret: "secret",
    fetchImpl,
  })
  return { extractor, calls }
}

describe("migratable status set", () => {
  it("imports every Convex survey status, including drafts", () => {
    expect([...ETL_MIGRATABLE_STATUSES].sort()).toEqual(["approved", "draft", "rejected", "submitted"])
  })

  it("leaves no Convex status unaccounted for", () => {
    const unhandled = CONVEX_SURVEY_STATUSES.filter(
      (status) => !(ETL_MIGRATABLE_STATUSES as readonly string[]).includes(status)
    )
    expect(unhandled).toEqual([])
  })
})

describe("ConvexHttpExtractor status filtering", () => {
  it("asks Convex for every migratable status, including drafts", async () => {
    const { extractor, calls } = extractorWithCapture({ ids: [], continueCursor: "", isDone: true })

    await extractor.listSurveyIds({
      cursor: null,
      numItems: 100,
      statuses: ETL_MIGRATABLE_STATUSES,
    })

    expect(calls[0]?.url).toBe("https://example.convex.site/etl/list-survey-ids")
    expect(calls[0]?.body.statuses).toEqual(["draft", "submitted", "approved", "rejected"])
  })

  it("omits the filter entirely when no statuses are given", async () => {
    const { extractor, calls } = extractorWithCapture({ ids: [], continueCursor: "", isDone: true })

    await extractor.listSurveyIds({ cursor: null, numItems: 1 })

    expect(calls[0]?.body).not.toHaveProperty("statuses")
  })

  it("counts the same statuses it imports so the validation delta is comparable", async () => {
    const { extractor, calls } = extractorWithCapture({ count: 7 })

    await expect(extractor.countSurveys(ETL_MIGRATABLE_STATUSES)).resolves.toBe(7)

    expect(calls[0]?.url).toBe("https://example.convex.site/etl/count-surveys")
    expect(calls[0]?.body.statuses).toEqual(["draft", "submitted", "approved", "rejected"])
  })
})
