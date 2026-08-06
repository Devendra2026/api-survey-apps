import "reflect-metadata"
import { describe, expect, it } from "@jest/globals"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { buildStorageKey } from "@workspace/etl-core"
import { AlignWardsDto, ReconcileDto, RefreshPendingDto } from "./dto/etl.dto.js"

describe("ETL API constants", () => {
  it("exposes etl:manage permission", () => {
    expect(PERMISSIONS.ETL_MANAGE).toBe("etl:manage")
  })
})

describe("ETL storage key contract", () => {
  it("matches production S3 layout", () => {
    expect(
      buildStorageKey({
        districtCode: "05",
        wardNo: "12",
        legacySurveyId: "SURVEY-100254",
        slot: "front",
        extension: "webp",
      })
    ).toBe("etah-images/district-05/ward-12/SURVEY-100254/front.webp")
  })
})

describe("RefreshPendingDto validation", () => {
  it("rejects missing districtId", async () => {
    const dto = plainToInstance(RefreshPendingDto, { apply: true })
    const errors = await validate(dto)
    expect(errors.map((e) => e.property)).toContain("districtId")
  })

  it("rejects empty districtId", async () => {
    const dto = plainToInstance(RefreshPendingDto, { districtId: "", apply: true })
    const errors = await validate(dto)
    expect(errors.map((e) => e.property)).toContain("districtId")
  })

  it("rejects missing apply", async () => {
    const dto = plainToInstance(RefreshPendingDto, { districtId: "district-1" })
    const errors = await validate(dto)
    expect(errors.map((e) => e.property)).toContain("apply")
  })

  it("accepts a valid dry-run payload", async () => {
    const dto = plainToInstance(RefreshPendingDto, { districtId: "district-1", apply: false, batchSize: 50 })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })
})

describe("AlignWardsDto validation", () => {
  it("rejects missing districtId", async () => {
    const dto = plainToInstance(AlignWardsDto, { apply: true })
    const errors = await validate(dto)
    expect(errors.map((e) => e.property)).toContain("districtId")
  })

  it("rejects empty districtId", async () => {
    const dto = plainToInstance(AlignWardsDto, { districtId: "", apply: true })
    const errors = await validate(dto)
    expect(errors.map((e) => e.property)).toContain("districtId")
  })

  it("rejects missing apply", async () => {
    const dto = plainToInstance(AlignWardsDto, { districtId: "district-1" })
    const errors = await validate(dto)
    expect(errors.map((e) => e.property)).toContain("apply")
  })

  it("accepts a valid scoped payload", async () => {
    const dto = plainToInstance(AlignWardsDto, { districtId: "district-1", apply: false, ulbCode: "ULB-01" })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })
})

describe("ReconcileDto validation", () => {
  it("rejects missing districtId", async () => {
    const dto = plainToInstance(ReconcileDto, {})
    const errors = await validate(dto)
    expect(errors.map((e) => e.property)).toContain("districtId")
  })

  it("rejects empty districtId", async () => {
    const dto = plainToInstance(ReconcileDto, { districtId: "" })
    const errors = await validate(dto)
    expect(errors.map((e) => e.property)).toContain("districtId")
  })

  it("accepts a valid districtId", async () => {
    const dto = plainToInstance(ReconcileDto, { districtId: "district-1" })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })
})
