import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { HttpStatus } from "@nestjs/common"
import { GlobalExceptionFilter } from "./global-exception.filter.js"

describe("GlobalExceptionFilter unique vs prisma dump", () => {
  const filter = new GlobalExceptionFilter()
  let statusCode = 0
  let body: { message?: string; statusCode?: number } = {}

  const response = {
    status: (code: number) => {
      statusCode = code
      return {
        json: (payload: { message?: string; statusCode?: number }) => {
          body = payload
        },
      }
    },
  }

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: "POST", url: "/etl/align-wards-with-convex" }),
    }),
  }

  beforeEach(() => {
    statusCode = 0
    body = {}
    jest.spyOn(console, "error").mockImplementation(() => {})
  })

  it("maps Unique constraint failed to duplicate conflict toast", () => {
    filter.catch(new Error("Unique constraint failed on the fields: (`ulbId`,`wardNumber`)"), host as never)
    expect(statusCode).toBe(HttpStatus.CONFLICT)
    expect(body.message).toMatch(/duplicate code or name/i)
  })

  it("maps P2002 to duplicate conflict toast", () => {
    const err = Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target: ["wardCode"] } })
    filter.catch(err, host as never)
    expect(statusCode).toBe(HttpStatus.CONFLICT)
    expect(body.message).toMatch(/duplicate code or name/i)
  })

  it("does NOT label generic prisma. invocation dumps as duplicate (hypothesis F)", () => {
    filter.catch(new Error("Invalid `prisma.ward.update()` invocation:\n\nRecord to update not found."), host as never)
    expect(statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(body.message).not.toMatch(/duplicate code or name/i)
    expect(body.message).toMatch(/database operation failed/i)
  })

  it("maps missing REFRESH_PENDING enum to an actionable migrate message", () => {
    filter.catch(
      new Error(
        'Invalid `prisma.migrationJob.create()` invocation:\n\ninvalid input value for enum "MigrationJobType": "REFRESH_PENDING"'
      ),
      host as never
    )
    expect(statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE)
    expect(body.message).toMatch(/REFRESH_PENDING/i)
    expect(body.message).toMatch(/migrate deploy/i)
  })
})
