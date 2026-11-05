import { describe, expect, it } from "@jest/globals"
import { isPublicImageKey } from "./public-storage.controller.js"

describe("isPublicImageKey", () => {
  it("allows survey photo keys used by Excel Parcel Images links", () => {
    expect(isPublicImageKey("uploads/st/di/ulb/ward/survey/s1/1b2c.jpg")).toBe(true)
    expect(isPublicImageKey("etah-images/district-12/ward-3/legacy-1/front.webp")).toBe(true)
    expect(isPublicImageKey("surveys/s1/photo.PNG")).toBe(true)
  })

  it("never exposes import workbooks or report exports", () => {
    expect(isPublicImageKey("imports/user1/job1/abc-ward.xlsx")).toBe(false)
    expect(isPublicImageKey("imports/user1/job1/validation-report.json")).toBe(false)
    expect(isPublicImageKey("exports/user1/job1/ward-1.xlsx")).toBe(false)
    expect(isPublicImageKey("exports/user1/job1/fake.jpg")).toBe(false)
  })

  it("rejects non-image objects and URLs", () => {
    expect(isPublicImageKey("uploads/a/b/report.pdf")).toBe(false)
    expect(isPublicImageKey("https://evil.example/a.jpg")).toBe(false)
    expect(isPublicImageKey("nofolder.jpg")).toBe(false)
  })
})
