import { describe, expect, it } from "@jest/globals"
import {
  expandInlineCoOwners,
  expandInlineFloors,
  expandInlinePhotos,
  mergeChildSheetsWithInline,
} from "@workspace/validation"

describe("expandInlinePhotos", () => {
  it("parses Type | url; Type | url", () => {
    const rows = expandInlinePhotos(
      "800726-001-00001-001-R",
      "Front | https://api.sdvedutech.in/a.jpg; Side | https://api.sdvedutech.in/b.jpg"
    )
    expect(rows).toEqual([
      {
        "Property ID": "800726-001-00001-001-R",
        Slot: "Front",
        "Slot Key": "Front",
        "Photo URL": "https://api.sdvedutech.in/a.jpg",
      },
      {
        "Property ID": "800726-001-00001-001-R",
        Slot: "Side",
        "Slot Key": "Side",
        "Photo URL": "https://api.sdvedutech.in/b.jpg",
      },
    ])
  })

  it("parses JSON array of {type,url}", () => {
    const rows = expandInlinePhotos(
      "P1",
      JSON.stringify([
        { type: "front", url: "https://cdn.example/f.jpg" },
        { type: "inside", url: "https://cdn.example/i.jpg" },
      ])
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]?.["Slot Key"]).toBe("front")
    expect(rows[1]?.["Photo URL"]).toBe("https://cdn.example/i.jpg")
  })
})

describe("expandInlineFloors", () => {
  it("parses position:floor | usage | construction | occupancy | area | usageFactor", () => {
    const rows = expandInlineFloors(
      "P1",
      "0:ground_floor | self_occupied | pakka_building_with_rcc_roof | Occupied | 850 | residential"
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      "Property ID": "P1",
      Position: "0",
      Floor: "ground_floor",
      "Usage Type": "self_occupied",
      "Construction Type": "pakka_building_with_rcc_roof",
      Occupancy: "Occupied",
      "Area (Sqft)": "850",
      "Usage Factor": "residential",
    })
  })

  it("parses multiple floors separated by ||", () => {
    const rows = expandInlineFloors(
      "P1",
      "0:ground_floor | self_occupied | tin_shed | Occupied | 400 || 1:first_floor | rented | tin_shed | Vacant | 300"
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]?.Floor).toBe("ground_floor")
    expect(rows[1]?.Floor).toBe("first_floor")
    expect(rows[1]?.["Usage Type"]).toBe("rented")
  })
})

describe("expandInlineCoOwners", () => {
  it("parses JSON owner array", () => {
    const rows = expandInlineCoOwners(
      "P1",
      JSON.stringify([{ name: "Asha Devi", fatherOrHusbandName: "Ram", mobileNo: "999" }])
    )
    expect(rows).toEqual([
      {
        "Property ID": "P1",
        "Owner Index": "1",
        Name: "Asha Devi",
        "Father / Husband Name": "Ram",
        Mobile: "999",
        "Alt Mobile": "",
      },
    ])
  })

  it("parses Name | Father | Mobile; Name2", () => {
    const rows = expandInlineCoOwners("P1", "Asha | Ram | 111; Sita | Shyam | 222")
    expect(rows).toHaveLength(2)
    expect(rows[1]?.Name).toBe("Sita")
    expect(rows[1]?.Mobile).toBe("222")
  })
})

describe("mergeChildSheetsWithInline", () => {
  it("uses inline when sheets are empty", () => {
    const merged = mergeChildSheetsWithInline(
      [
        {
          "Property ID": "P1",
          Photos: "Front | https://x/a.jpg",
          Floors: "0:ground_floor | self_occupied | tin_shed | Occupied | 100",
          CoOwners: "Asha",
        },
      ],
      { coOwners: [], floors: [], photos: [] }
    )
    expect(merged.photos).toHaveLength(1)
    expect(merged.floors).toHaveLength(1)
    expect(merged.coOwners).toHaveLength(1)
    expect(merged.usedInlineColumns).toBe(true)
    expect(merged.sheetPreferredWarning).toBe(false)
  })

  it("prefers dedicated sheets when both exist", () => {
    const merged = mergeChildSheetsWithInline([{ "Property ID": "P1", Photos: "Front | https://inline/a.jpg" }], {
      coOwners: [],
      floors: [],
      photos: [{ "Property ID": "P1", "Slot Key": "side", "Photo URL": "https://sheet/b.jpg" }],
    })
    expect(merged.photos).toHaveLength(1)
    expect(merged.photos[0]?.["Photo URL"]).toBe("https://sheet/b.jpg")
    expect(merged.sheetPreferredWarning).toBe(true)
  })
})
