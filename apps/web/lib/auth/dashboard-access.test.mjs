import assert from "node:assert/strict"
import test from "node:test"

import { hasDashboardAccess } from "./dashboard-access.ts"

test("denies dashboard access when permissions are absent", () => {
  assert.equal(hasDashboardAccess(undefined), false)
  assert.equal(hasDashboardAccess(null), false)
})

test("denies dashboard access when permissions are empty", () => {
  assert.equal(hasDashboardAccess([]), false)
})

test("allows dashboard access when at least one permission is assigned", () => {
  assert.equal(hasDashboardAccess(["survey:read"]), true)
})
