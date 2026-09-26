import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canEnterAppHome,
  primaryRoleName,
  resolveAppHomeHref,
  type AuthenticatedProfile,
  type TenantRole,
} from "./user.ts"

function role(name: string, isActive = true): TenantRole {
  return {
    id: `utr_${name}`,
    role: { id: `role_${name}`, name },
    isActive,
  }
}

function profile(
  partial: Partial<AuthenticatedProfile> & {
    permissions?: string[]
    tenantRoles?: TenantRole[]
  }
): AuthenticatedProfile {
  return {
    id: "user_1",
    clerkUserId: "user_clerk_1",
    email: "a@example.com",
    fullName: "Test User",
    isActive: true,
    permissions: partial.permissions ?? ["survey:view"],
    tenantRoles: partial.tenantRoles ?? [],
    ...partial,
  }
}

describe("primaryRoleName", () => {
  it("prefers ADMIN when multiple active roles exist", () => {
    const result = primaryRoleName(
      profile({
        tenantRoles: [role("SURVEYOR"), role("ADMIN")],
      })
    )
    assert.equal(result, "ADMIN")
  })

  it("returns first non-pending role when ADMIN is absent", () => {
    const result = primaryRoleName(
      profile({
        tenantRoles: [role("PENDING_APPROVAL"), role("FIELD_SUPERVISOR")],
      })
    )
    assert.equal(result, "FIELD_SUPERVISOR")
  })
})

describe("resolveAppHomeHref", () => {
  it("routes ADMIN to admin shell", () => {
    assert.equal(
      resolveAppHomeHref(
        profile({
          permissions: ["settings:manage"],
          tenantRoles: [role("ADMIN")],
        })
      ),
      "/(app)/admin"
    )
  })

  it("routes SURVEYOR to survey shell", () => {
    assert.equal(
      resolveAppHomeHref(
        profile({
          tenantRoles: [role("SURVEYOR")],
        })
      ),
      "/(app)/survey"
    )
  })

  it("routes FIELD_SUPERVISOR to survey shell", () => {
    assert.equal(
      resolveAppHomeHref(
        profile({
          tenantRoles: [role("FIELD_SUPERVISOR")],
        })
      ),
      "/(app)/survey"
    )
  })

  it("routes QC_SUPERVISOR to survey shell", () => {
    assert.equal(
      resolveAppHomeHref(
        profile({
          tenantRoles: [role("QC_SUPERVISOR")],
        })
      ),
      "/(app)/survey"
    )
  })

  it("routes ADMIN ahead of surveyor when both are active", () => {
    assert.equal(
      resolveAppHomeHref(
        profile({
          permissions: ["survey:view", "settings:manage"],
          tenantRoles: [role("SURVEYOR"), role("ADMIN")],
        })
      ),
      "/(app)/admin"
    )
  })

  it("returns null for pending-only users", () => {
    assert.equal(
      resolveAppHomeHref(
        profile({
          permissions: [],
          tenantRoles: [role("PENDING_APPROVAL")],
        })
      ),
      null
    )
  })

  it("returns null for unknown role codes even with permissions", () => {
    assert.equal(
      resolveAppHomeHref(
        profile({
          permissions: ["survey:view"],
          tenantRoles: [role("LEGACY_UNKNOWN")],
        })
      ),
      null
    )
  })

  it("returns null when profile is missing", () => {
    assert.equal(resolveAppHomeHref(null), null)
    assert.equal(resolveAppHomeHref(undefined), null)
  })
})

describe("canEnterAppHome", () => {
  it("is true only for known mobile home roles with permissions", () => {
    assert.equal(
      canEnterAppHome(
        profile({
          tenantRoles: [role("SURVEYOR")],
        })
      ),
      true
    )
    assert.equal(
      canEnterAppHome(
        profile({
          permissions: [],
          tenantRoles: [role("SURVEYOR")],
        })
      ),
      false
    )
    assert.equal(
      canEnterAppHome(
        profile({
          permissions: ["survey:view"],
          tenantRoles: [role("WEIRD_ROLE")],
        })
      ),
      false
    )
  })
})
