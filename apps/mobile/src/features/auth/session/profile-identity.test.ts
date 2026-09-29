import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { canEnterAppHome, resolveAppHomeHref, type AuthenticatedProfile, type TenantRole } from "../../../types/user.ts"
import {
  formatIdentityDiagnostics,
  isApiTokenRejectedMessage,
  isProfileRequestCurrent,
  isTransientTokenUserMismatch,
  profileCacheKey,
  profileMatchesSession,
  resolveSsoSessionId,
  SESSION_MESSAGES,
  shouldAutoSignOutOnProfile401,
  shouldCommitProfileResponse,
} from "./profile-identity.ts"

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
    id: "uuid_internal_1",
    clerkUserId: "user_clerk_1",
    email: "a@example.com",
    fullName: "Test User",
    isActive: true,
    permissions: partial.permissions ?? ["survey:view"],
    tenantRoles: partial.tenantRoles ?? [role("SURVEYOR")],
    ...partial,
  }
}

describe("profileMatchesSession", () => {
  it("matches when profile.clerkUserId equals auth userId", () => {
    assert.equal(profileMatchesSession("user_a", "user_a", null), true)
  })

  it("never matches without a current Clerk userId, even if the token subject matches", () => {
    assert.equal(profileMatchesSession("user_a", null, "user_a"), false)
  })

  it("rejects a stale token subject even when profile equals it (Surveyor A token, Surveyor B session)", () => {
    assert.equal(profileMatchesSession("user_a", "user_b", "user_a"), false)
  })

  it("rejects a profile for the session user loaded with another user's bearer", () => {
    assert.equal(profileMatchesSession("user_b", "user_b", "user_a"), false)
  })

  it("does not treat Prisma User.id as Clerk identity", () => {
    const appUser = profile({ id: "uuid_a", clerkUserId: "user_a" })
    assert.notEqual(appUser.id, "user_a")
    assert.equal(profileMatchesSession(appUser.clerkUserId, "user_a", "user_a"), true)
    assert.equal(profileMatchesSession(appUser.id, "user_a", "user_a"), false)
  })

  it("rejects when profile belongs to a different Clerk user", () => {
    assert.equal(profileMatchesSession("user_a", "user_b", "user_b"), false)
  })
})

describe("shouldCommitProfileResponse", () => {
  it("commits when request id and clerk ids align", () => {
    assert.equal(
      shouldCommitProfileResponse({
        requestId: 3,
        currentRequestId: 3,
        expectedClerkUserId: "user_b",
        currentClerkUserId: "user_b",
        profileClerkUserId: "user_b",
      }),
      true
    )
  })

  it("rejects a delayed User A response after User B is signed in", () => {
    assert.equal(
      shouldCommitProfileResponse({
        requestId: 1,
        currentRequestId: 2,
        expectedClerkUserId: "user_a",
        currentClerkUserId: "user_b",
        profileClerkUserId: "user_a",
      }),
      false
    )
  })

  it("rejects when profile clerkUserId does not match expected session", () => {
    assert.equal(
      shouldCommitProfileResponse({
        requestId: 5,
        currentRequestId: 5,
        expectedClerkUserId: "user_b",
        currentClerkUserId: "user_b",
        profileClerkUserId: "user_a",
      }),
      false
    )
  })
})

describe("isProfileRequestCurrent", () => {
  it("is current when generation and Clerk user are unchanged", () => {
    assert.equal(
      isProfileRequestCurrent({
        requestId: 2,
        currentRequestId: 2,
        expectedClerkUserId: "user_a",
        currentClerkUserId: "user_a",
      }),
      true
    )
  })

  it("is stale after sign-out or a newer fetch", () => {
    assert.equal(
      isProfileRequestCurrent({
        requestId: 2,
        currentRequestId: 3,
        expectedClerkUserId: "user_a",
        currentClerkUserId: "user_a",
      }),
      false
    )
    assert.equal(
      isProfileRequestCurrent({
        requestId: 2,
        currentRequestId: 2,
        expectedClerkUserId: "user_a",
        currentClerkUserId: null,
      }),
      false
    )
  })

  it("is stale when Clerk switched users mid-request", () => {
    assert.equal(
      isProfileRequestCurrent({
        requestId: 2,
        currentRequestId: 2,
        expectedClerkUserId: "user_a",
        currentClerkUserId: "user_b",
      }),
      false
    )
  })
})

describe("identity diagnostics", () => {
  it("scopes the profile cache key by Clerk userId", () => {
    assert.equal(profileCacheKey("user_a"), "profile:user_a")
    assert.notEqual(profileCacheKey("user_a"), profileCacheKey("user_b"))
  })

  it("formats ids, role and status without any token field", () => {
    const line = formatIdentityDiagnostics({
      clerkUserId: "user_a",
      authenticatedUserId: "user_a",
      databaseUserId: "uuid_a",
      databaseClerkUserId: "user_a",
      profileClerkUserId: "user_a",
      role: "SURVEYOR",
      status: "ACTIVE",
      assignmentIds: ["utr_1", "utr_2"],
      cacheKey: "profile:user_a",
      navigationState: "ready",
    })
    assert.match(line, /clerkUserId=user_a/)
    assert.match(line, /databaseUserId=uuid_a/)
    assert.match(line, /assignmentIds=utr_1,utr_2/)
    assert.match(line, /navigationState=ready/)
    assert.doesNotMatch(line, /token=|bearer|secret|password/i)
  })
})

describe("isTransientTokenUserMismatch", () => {
  it("detects stale token subject after Google setActive", () => {
    assert.equal(isTransientTokenUserMismatch("user_new", "user_old"), true)
  })

  it("is false when token subject matches expected user", () => {
    assert.equal(isTransientTokenUserMismatch("user_a", "user_a"), false)
  })

  it("is false when token subject is not yet available", () => {
    assert.equal(isTransientTokenUserMismatch("user_a", null), false)
  })
})

describe("shouldAutoSignOutOnProfile401", () => {
  it("never auto-signs-out on account-link or resolve failures", () => {
    assert.equal(
      shouldAutoSignOutOnProfile401(
        "This email is already linked to a different Clerk account. Sign in with the original account or contact an administrator."
      ),
      false
    )
    assert.equal(shouldAutoSignOutOnProfile401("Unable to resolve your account profile. Please try again."), false)
  })

  it("never auto-signs-out on generic 401 (keep session for Retry / Sign out)", () => {
    assert.equal(shouldAutoSignOutOnProfile401("Invalid or expired token"), false)
  })
})

describe("session error classification", () => {
  it("treats Nest JWT verification copy as API token rejection, not a vague expiry", () => {
    assert.equal(isApiTokenRejectedMessage("Invalid or expired token"), true)
    assert.equal(isApiTokenRejectedMessage("Missing Bearer token"), true)
    assert.equal(isApiTokenRejectedMessage("This email is already linked to a different Clerk account."), false)
    assert.notEqual(SESSION_MESSAGES.apiTokenRejected, SESSION_MESSAGES.sessionExpired)
    assert.notEqual(SESSION_MESSAGES.sessionTokenUnavailable, SESSION_MESSAGES.sessionExpired)
  })
})

describe("resolveSsoSessionId", () => {
  it("prefers top-level createdSessionId", () => {
    assert.equal(
      resolveSsoSessionId({
        createdSessionId: "sess_top",
        signInCreatedSessionId: "sess_in",
        signUpCreatedSessionId: "sess_up",
      }),
      "sess_top"
    )
  })

  it("falls back to signIn then signUp session ids", () => {
    assert.equal(
      resolveSsoSessionId({
        createdSessionId: null,
        signInCreatedSessionId: "sess_in",
      }),
      "sess_in"
    )
    assert.equal(
      resolveSsoSessionId({
        createdSessionId: null,
        signInCreatedSessionId: null,
        signUpCreatedSessionId: "sess_up",
      }),
      "sess_up"
    )
  })
})

describe("pending vs active home routing", () => {
  it("routes active surveyor to survey home", () => {
    const surveyor = profile({
      permissions: ["survey:view"],
      tenantRoles: [role("SURVEYOR")],
    })
    assert.equal(canEnterAppHome(surveyor), true)
    assert.equal(resolveAppHomeHref(surveyor), "/(app)/survey")
  })

  it("keeps pending approval on pending (no home)", () => {
    const pending = profile({
      permissions: [],
      tenantRoles: [role("PENDING_APPROVAL")],
    })
    assert.equal(canEnterAppHome(pending), false)
    assert.equal(resolveAppHomeHref(pending), null)
  })
})
