import { describe, expect, it } from "@jest/globals"
import { parcelNumberVariants } from "./parcel-search.util.js"

describe("parcelNumberVariants", () => {
  it("returns the same set for unpadded and padded forms of 1", () => {
    const expected = new Set(["1", "01", "001", "0001", "00001"])
    expect(new Set(parcelNumberVariants("1"))).toEqual(expected)
    expect(new Set(parcelNumberVariants("00001"))).toEqual(expected)
    expect(new Set(parcelNumberVariants("0001"))).toEqual(expected)
  })

  it("strips non-digits before building variants", () => {
    expect(new Set(parcelNumberVariants("parcel-42"))).toEqual(new Set(["42", "042", "0042", "00042"]))
  })

  it("returns empty for non-numeric input", () => {
    expect(parcelNumberVariants("abc")).toEqual([])
    expect(parcelNumberVariants("")).toEqual([])
    expect(parcelNumberVariants("---")).toEqual([])
  })

  it("returns only itself for 6-digit input (beyond pad length)", () => {
    expect(parcelNumberVariants("123456")).toEqual(["123456"])
  })

  it("returns only itself for already 5-digit non-leading-zero values", () => {
    expect(parcelNumberVariants("12345")).toEqual(["12345"])
  })
})
