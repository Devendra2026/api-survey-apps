import { describe, expect, it } from "@jest/globals"
import { CursorConflictError } from "./cursor_manager.js"
import { loadAuditEtlConfig } from "./config.js"

describe("loadAuditEtlConfig", () => {
  it("applies defaults and overrides", () => {
    const config = loadAuditEtlConfig(
      {
        CONVEX_SITE_URL: " https://example.convex.site ",
        ETL_CONVEX_SECRET: " secret ",
      },
      { batchSize: 100 }
    )
    expect(config.convexSiteUrl).toBe("https://example.convex.site")
    expect(config.etlSecret).toBe("secret")
    expect(config.batchSize).toBe(100)
    expect(config.pipelineKey).toBe("convex-audit-logs")
  })
})

describe("CursorConflictError", () => {
  it("is an Error subclass", () => {
    const err = new CursorConflictError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("CursorConflictError")
  })
})
