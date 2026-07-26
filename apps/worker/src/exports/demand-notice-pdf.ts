import { Logger } from "@nestjs/common"
import { chromium } from "playwright"
import { PRINT_TOKEN_TTL_MS, signDemandNoticePrintToken } from "./demand-notice-print-token.js"

const logger = new Logger("DemandNoticePdf")

export async function renderWardDemandNoticePdf(options: {
  webInternalUrl: string
  printSecret: string
  wardId: string
  assessmentYearId?: string
}): Promise<Buffer> {
  const base = options.webInternalUrl.replace(/\/$/, "")
  const token = signDemandNoticePrintToken(
    {
      wardId: options.wardId,
      assessmentYearId: options.assessmentYearId,
      exp: Date.now() + PRINT_TOKEN_TTL_MS,
    },
    options.printSecret
  )

  const qs = new URLSearchParams({
    token,
    wardId: options.wardId,
  })
  if (options.assessmentYearId) qs.set("assessmentYearId", options.assessmentYearId)

  const url = `${base}/print/demand-notices/ward?${qs.toString()}`
  logger.log(`Playwright PDF goto ${url.replace(token, "[token]")}`)

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })

  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 })
    await page.waitForSelector('[data-print-ready="true"]', { timeout: 120_000 })
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
