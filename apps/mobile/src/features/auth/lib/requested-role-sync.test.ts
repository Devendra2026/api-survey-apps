import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { AuthenticatedProfile, TenantRole } from "../../../types/user.ts"
import { requestedRoleToSync } from "./requested-role-sync.ts"

function role(name: string): TenantRole {
  return {
    id: `utr_${name}`,
    role: { id: `role_${name}`, name },
    isActive: true,
  }
}

function profile(partial: Partial<AuthenticatedProfile>): AuthenticatedProfile {
  return {
    id: "user_1",
    clerkUserId: "user_clerk_1",
    email: "a@example.com",
    fullName: "Test User",
    isActive: true,
    permissions: [],
    tenantRoles: [role("PENDING_APPROVAL")],
    ...partial,
  }
}

describe("requestedRoleToSync", () => {
  it("sets Surveyor for a new pending account", () => {
    assert.equal(requestedRoleToSync(profile({ requestedRole: null }), "SURVEYOR"), "SURVEYOR")
  })

  it("sets Supervisor for a new pending account", () => {
    assert.equal(requestedRoleToSync(profile({ requestedRole: null }), "FIELD_SUPERVISOR"), "FIELD_SUPERVISOR")
  })

  it("does not write when the pending account already requested the same role", () => {
    assert.equal(requestedRoleToSync(profile({ requestedRole: "SURVEYOR" }), "SURVEYOR"), undefined)
  })

  it("replaces a pending role request with a different role", () => {
    assert.equal(requestedRoleToSync(profile({ requestedRole: "SURVEYOR" }), "FIELD_SUPERVISOR"), "FIELD_SUPERVISOR")
  })

  it("does not change an onboarded account", () => {
    const onboarded = profile({
      requestedRole: "SURVEYOR",
      permissions: ["survey:view"],
      tenantRoles: [role("SURVEYOR")],
    })
    assert.equal(requestedRoleToSync(onboarded, "FIELD_SUPERVISOR"), undefined)
  })

  it("does not change an inactive account", () => {
    assert.equal(requestedRoleToSync(profile({ isActive: false, requestedRole: null }), "SURVEYOR"), undefined)
  })

  it("does nothing when no role was staged", () => {
    assert.equal(requestedRoleToSync(profile({ requestedRole: null }), null), undefined)
  })
})
