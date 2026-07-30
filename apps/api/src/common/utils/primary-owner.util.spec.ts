import { describe, expect, it } from "@jest/globals"
import { resolvePrimaryOwnerName } from "./primary-owner.util.js"

describe("resolvePrimaryOwnerName", () => {
  it("prefers the first co-owner name", () => {
    expect(resolvePrimaryOwnerName([{ name: "Ramjeet Shaky" }, { name: "Other" }], "Kishan")).toBe("Ramjeet Shaky")
  })

  it("falls back to respondent when co-owners are empty", () => {
    expect(resolvePrimaryOwnerName([], "Kishan")).toBe("Kishan")
  })

  it("falls back to respondent when first co-owner name is blank", () => {
    expect(resolvePrimaryOwnerName([{ name: "  " }, { name: "Other" }], "Kishan")).toBe("Kishan")
  })

  it("falls back to respondent when co-owners are null or undefined", () => {
    expect(resolvePrimaryOwnerName(null, "Kishan")).toBe("Kishan")
    expect(resolvePrimaryOwnerName(undefined, "Kishan")).toBe("Kishan")
  })

  it("returns null when both sources are empty", () => {
    expect(resolvePrimaryOwnerName([], null)).toBeNull()
    expect(resolvePrimaryOwnerName([{ name: "" }], "  ")).toBeNull()
  })

  it("trims whitespace on both sources", () => {
    expect(resolvePrimaryOwnerName([{ name: "  Ramjeet  " }], "Kishan")).toBe("Ramjeet")
    expect(resolvePrimaryOwnerName([], "  Kishan  ")).toBe("Kishan")
  })
})
