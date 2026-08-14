import { describe, expect, it } from "@jest/globals"
import { IS_PUBLIC_KEY } from "../common/decorators/public.decorator.js"
import { PortalSurveysController } from "./portal-surveys.controller.js"

describe("PortalSurveysController", () => {
  it("is public so ClerkAuthGuard is skipped", () => {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, PortalSurveysController) as boolean
    expect(isPublic).toBe(true)
  })
})
