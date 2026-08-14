import { describe, expect, it } from "@jest/globals"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { PERMISSIONS_KEY } from "../common/decorators/require-permission.decorator.js"
import { UlbsController } from "./ulbs.controller.js"

describe("UlbsController API key permissions", () => {
  it("requires settings:manage for current and rotate", () => {
    /* eslint-disable @typescript-eslint/unbound-method -- Reflect.getMetadata needs the unbound method reference */
    const currentMeta = Reflect.getMetadata(PERMISSIONS_KEY, UlbsController.prototype.currentApiKey) as string[]
    const rotateMeta = Reflect.getMetadata(PERMISSIONS_KEY, UlbsController.prototype.rotateApiKey) as string[]
    /* eslint-enable @typescript-eslint/unbound-method */
    expect(currentMeta).toEqual([PERMISSIONS.SETTINGS_MANAGE])
    expect(rotateMeta).toEqual([PERMISSIONS.SETTINGS_MANAGE])
  })
})
