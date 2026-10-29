import { describe, expect, it } from "@jest/globals"
import { compareExportFloorOrder, getExportFloorRank, sortExportFloors } from "./floor-order.js"

describe("floor-order", () => {
  describe("getExportFloorRank", () => {
    it("ranks ground as 0", () => {
      expect(getExportFloorRank("GROUND_FLOOR")).toBe(0)
      expect(getExportFloorRank("Ground Floor")).toBe(0)
      expect(getExportFloorRank("GF")).toBe(0)
    })

    it("ranks numbered storeys ascending", () => {
      expect(getExportFloorRank("FIRST_FLOOR")).toBe(1)
      expect(getExportFloorRank("First Floor")).toBe(1)
      expect(getExportFloorRank("NINTH_FLOOR")).toBe(9)
      expect(getExportFloorRank("12TH_FLOOR")).toBe(12)
      expect(getExportFloorRank("TWELFTH_FLOOR")).toBe(12)
      expect(getExportFloorRank("FIFTH_FLOOR_PLUS")).toBe(5)
    })

    it("ranks basements deeper-first via negative depth", () => {
      expect(getExportFloorRank("BASEMENT")).toBe(-1)
      expect(getExportFloorRank("BASEMENT_1")).toBe(-1)
      expect(getExportFloorRank("BASEMENT_2")).toBe(-2)
      expect(getExportFloorRank("Basement 2")).toBe(-2)
      expect(getExportFloorRank("B2")).toBe(-2)
    })

    it("ranks terrace and open land after storeys; unknown last", () => {
      expect(getExportFloorRank("TERRACE")).toBe(100000)
      expect(getExportFloorRank("ROOF")).toBe(100000)
      expect(getExportFloorRank("OPEN_LAND")).toBe(110000)
      expect(getExportFloorRank("CUSTOM_LEVEL")).toBe(200000)
    })
  })

  describe("sortExportFloors", () => {
    it("keeps Ground then First unchanged", () => {
      const input = [
        { floorPosition: "GROUND_FLOOR", areaSqFt: 100 },
        { floorPosition: "FIRST_FLOOR", areaSqFt: 80 },
      ]
      const actual = sortExportFloors(input)
      expect(actual.map((f) => f.floorPosition)).toEqual(["GROUND_FLOOR", "FIRST_FLOOR"])
      expect(input.map((f) => f.floorPosition)).toEqual(["GROUND_FLOOR", "FIRST_FLOOR"])
    })

    it("sorts First then Ground to Ground then First", () => {
      const actual = sortExportFloors([
        { floorPosition: "FIRST_FLOOR", areaSqFt: 4480 },
        { floorPosition: "GROUND_FLOOR", areaSqFt: 4480 },
      ])
      expect(actual.map((f) => f.floorPosition)).toEqual(["GROUND_FLOOR", "FIRST_FLOOR"])
    })

    it("sorts Ground, First, Second, Third from random order", () => {
      const actual = sortExportFloors([
        { floorPosition: "THIRD_FLOOR", areaSqFt: 30 },
        { floorPosition: "GROUND_FLOOR", areaSqFt: 10 },
        { floorPosition: "SECOND_FLOOR", areaSqFt: 20 },
        { floorPosition: "FIRST_FLOOR", areaSqFt: 15 },
      ])
      expect(actual.map((f) => f.floorPosition)).toEqual(["GROUND_FLOOR", "FIRST_FLOOR", "SECOND_FLOOR", "THIRD_FLOOR"])
    })

    it("sorts multiple basements then Ground deeper-first", () => {
      const actual = sortExportFloors([
        { floorPosition: "BASEMENT_1", areaSqFt: 40 },
        { floorPosition: "GROUND_FLOOR", areaSqFt: 100 },
        { floorPosition: "BASEMENT_2", areaSqFt: 30 },
      ])
      expect(actual.map((f) => f.floorPosition)).toEqual(["BASEMENT_2", "BASEMENT_1", "GROUND_FLOOR"])
    })

    it("sorts floors above Ninth before Terrace", () => {
      const actual = sortExportFloors([
        { floorPosition: "TERRACE", areaSqFt: 10 },
        { floorPosition: "TWELFTH_FLOOR", areaSqFt: 12 },
        { floorPosition: "FIFTH_FLOOR", areaSqFt: 5 },
        { floorPosition: "NINTH_FLOOR", areaSqFt: 9 },
      ])
      expect(actual.map((f) => f.floorPosition)).toEqual(["FIFTH_FLOOR", "NINTH_FLOOR", "TWELFTH_FLOOR", "TERRACE"])
    })

    it("keeps area and usage metadata attached when reordering", () => {
      const actual = sortExportFloors([
        {
          floorPosition: "FIRST_FLOOR",
          areaSqFt: 50,
          usageFactor: "COMMERCIAL",
          usageType: "RENTED",
        },
        {
          floorPosition: "GROUND_FLOOR",
          areaSqFt: 100,
          usageFactor: "RESIDENTIAL",
          usageType: "SELF_OCCUPIED",
        },
      ])
      expect(actual).toEqual([
        {
          floorPosition: "GROUND_FLOOR",
          areaSqFt: 100,
          usageFactor: "RESIDENTIAL",
          usageType: "SELF_OCCUPIED",
        },
        {
          floorPosition: "FIRST_FLOOR",
          areaSqFt: 50,
          usageFactor: "COMMERCIAL",
          usageType: "RENTED",
        },
      ])
    })

    it("preserves duplicate floor entries with stable order", () => {
      const actual = sortExportFloors([
        { floorPosition: "GROUND_FLOOR", areaSqFt: 100, usageFactor: "RESIDENTIAL" },
        { floorPosition: "FIRST_FLOOR", areaSqFt: 80 },
        { floorPosition: "GROUND_FLOOR", areaSqFt: 50, usageFactor: "COMMERCIAL" },
      ])
      expect(actual).toEqual([
        { floorPosition: "GROUND_FLOOR", areaSqFt: 100, usageFactor: "RESIDENTIAL" },
        { floorPosition: "GROUND_FLOOR", areaSqFt: 50, usageFactor: "COMMERCIAL" },
        { floorPosition: "FIRST_FLOOR", areaSqFt: 80 },
      ])
    })

    it("handles empty input without throwing", () => {
      expect(sortExportFloors([])).toEqual([])
    })

    it("keeps unknown labels after Terrace and Open Land", () => {
      const actual = sortExportFloors([
        { floorPosition: "CUSTOM_LEVEL", areaSqFt: 1 },
        { floorPosition: "OPEN_LAND", areaSqFt: 0 },
        { floorPosition: "TERRACE", areaSqFt: 2 },
        { floorPosition: "GROUND_FLOOR", areaSqFt: 10 },
      ])
      expect(actual.map((f) => f.floorPosition)).toEqual(["GROUND_FLOOR", "TERRACE", "OPEN_LAND", "CUSTOM_LEVEL"])
    })

    it("compareExportFloorOrder returns 0 for equal ranks", () => {
      expect(compareExportFloorOrder("GROUND_FLOOR", "Ground Floor")).toBe(0)
      expect(compareExportFloorOrder("CUSTOM_A", "CUSTOM_B")).toBe(0)
    })
  })
})
