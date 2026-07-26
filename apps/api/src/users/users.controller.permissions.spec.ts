import { describe, expect, it } from "@jest/globals"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { PERMISSIONS_KEY } from "../common/decorators/require-permission.decorator.js"
import { UsersController } from "./users.controller.js"

describe("UsersController Clerk import/sync permissions", () => {
  it("requires user:create for sync-from-clerk and import", () => {
    // Method refs for Reflect metadata (decorators attach to the prototype function)
    /* eslint-disable @typescript-eslint/unbound-method -- Reflect.getMetadata needs the unbound method reference */
    const syncMeta = Reflect.getMetadata(PERMISSIONS_KEY, UsersController.prototype.syncFromClerk) as string[]
    const importMeta = Reflect.getMetadata(PERMISSIONS_KEY, UsersController.prototype.importUsers) as string[]
    /* eslint-enable @typescript-eslint/unbound-method */
    expect(syncMeta).toEqual([PERMISSIONS.USER_CREATE])
    expect(importMeta).toEqual([PERMISSIONS.USER_CREATE])
  })

  it("requires user:view for import template download", () => {
    /* eslint-disable-next-line @typescript-eslint/unbound-method -- Reflect.getMetadata needs the unbound method reference */
    const templateMeta = Reflect.getMetadata(PERMISSIONS_KEY, UsersController.prototype.importTemplate) as string[]
    expect(templateMeta).toEqual([PERMISSIONS.USER_VIEW])
  })
})
