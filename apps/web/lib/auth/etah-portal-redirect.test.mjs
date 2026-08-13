import assert from "node:assert/strict"
import test from "node:test"

import { shouldRedirectToEtahPortal } from "./etah-portal-redirect.ts"

test("does not redirect when roles are empty", () => {
  assert.equal(shouldRedirectToEtahPortal([]), false)
  assert.equal(shouldRedirectToEtahPortal(undefined), false)
})

test("redirects Etah department officers to the municipal portal", () => {
  assert.equal(
    shouldRedirectToEtahPortal([
      {
        isActive: true,
        roleName: "DEPT_CLERK",
        district: { name: "Etah" },
      },
    ]),
    true
  )
})

test("keeps platform admins and survey staff on admin", () => {
  assert.equal(
    shouldRedirectToEtahPortal([
      { isActive: true, roleName: "ADMIN", district: null },
      {
        isActive: true,
        roleName: "DEPT_ADMIN",
        district: { name: "Etah" },
      },
    ]),
    false
  )
  assert.equal(
    shouldRedirectToEtahPortal([
      {
        isActive: true,
        roleName: "SURVEYOR",
        district: { name: "Etah" },
      },
    ]),
    false
  )
})
