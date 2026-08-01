import { describe, expect, it } from "@jest/globals"
import { isFullyLockedSystemRole, isSystemRole, validatePermissionChange } from "./system-role-policy.js"

describe("system-role-policy", () => {
  it("identifies system roles", () => {
    expect(isSystemRole("ADMIN")).toBe(true)
    expect(isSystemRole("QC_MANAGER")).toBe(false)
  })

  it("allows full permission edits on all system roles", () => {
    expect(isFullyLockedSystemRole("ADMIN")).toBe(false)
    expect(isFullyLockedSystemRole("PENDING_APPROVAL")).toBe(false)
    expect(isFullyLockedSystemRole("SURVEYOR")).toBe(false)
    expect(validatePermissionChange("ADMIN", new Set(["dashboard:view"]))).toBeNull()
    expect(validatePermissionChange("SURVEYOR", new Set(["survey:view"]))).toBeNull()
  })

  it("allows any change on custom roles", () => {
    expect(validatePermissionChange("CUSTOM_ROLE", new Set(["dashboard:view"]))).toBeNull()
  })
})
