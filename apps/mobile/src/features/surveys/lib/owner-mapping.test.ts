import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mergeCoOwners, ownerContactPatch, primaryOwnerId, respondentFieldsPatch, sortOwners } from "./owner-mapping.ts"

describe("owner mapping", () => {
  it("keeps respondent edits off owner and household fields", () => {
    const patch = respondentFieldsPatch({ respondentName: "Rama", relationshipWithOwner: "Tenant" })
    assert.deepEqual(patch, { respondentName: "Rama", relationshipWithOwner: "Tenant" })
    assert.equal("mobileNumber" in patch, false)
    assert.equal("name" in patch, false)
  })

  it("writes owner 1 phones onto the survey contact and leaves later owners alone", () => {
    const primary = ownerContactPatch({ isPrimary: true, mobile: "9999999999", alternateMobile: "8888888888" })
    const second = ownerContactPatch({ isPrimary: false, mobile: "7777777777", alternateMobile: null })
    assert.deepEqual(primary, { mobileNumber: "9999999999", alternateMobile: "8888888888" })
    assert.equal(second, null)
  })

  it("keeps a locally created owner when a survey save returns the previous list", () => {
    const previous = [{ id: "existing" }, { id: "created" }]
    const incoming = [{ id: "existing" }]
    assert.deepEqual(
      mergeCoOwners(previous, incoming).map((owner) => owner.id),
      ["existing", "created"]
    )
    assert.deepEqual(
      mergeCoOwners(incoming, previous).map((owner) => owner.id),
      ["existing", "created"]
    )
  })

  it("treats the earliest co-owner as owner 1", () => {
    const owners = [
      { id: "b", createdAt: "2026-02-01T00:00:00.000Z" },
      { id: "a", createdAt: "2026-01-01T00:00:00.000Z" },
    ]
    assert.deepEqual(
      sortOwners(owners).map((owner) => owner.id),
      ["a", "b"]
    )
    assert.equal(primaryOwnerId(owners), "a")
  })
})
