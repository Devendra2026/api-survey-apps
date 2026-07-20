import {
  isFullyLockedSystemRole,
  isSystemRole,
  protectedPermissionNames,
  validatePermissionChange,
} from "./system-role-policy.js"

describe("system-role-policy", () => {
  it("identifies system roles", () => {
    expect(isSystemRole("ADMIN")).toBe(true)
    expect(isSystemRole("QC_MANAGER")).toBe(false)
  })

  it("fully locks ADMIN and PENDING_APPROVAL", () => {
    expect(isFullyLockedSystemRole("ADMIN")).toBe(true)
    expect(isFullyLockedSystemRole("PENDING_APPROVAL")).toBe(true)
    expect(isFullyLockedSystemRole("SURVEYOR")).toBe(false)
    expect(validatePermissionChange("ADMIN", new Set(["dashboard:view"]))).toContain("cannot be modified")
  })

  it("blocks removing protected baseline from add-only roles", () => {
    const next = new Set(["survey:view", "dashboard:view"])
    const error = validatePermissionChange("SURVEYOR", next)
    expect(error).toContain("protected system permission")
  })

  it("allows adding permissions to SURVEYOR when baseline kept", () => {
    const baseline = protectedPermissionNames("SURVEYOR")
    const next = new Set([...baseline, "report:view"])
    expect(validatePermissionChange("SURVEYOR", next)).toBeNull()
  })

  it("allows any change on custom roles", () => {
    expect(validatePermissionChange("CUSTOM_ROLE", new Set(["dashboard:view"]))).toBeNull()
  })
})
