import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { friendlyHttpMessage, profileLoadUserMessage } from "./error-messages.ts"

describe("friendlyHttpMessage", () => {
  it("preserves Nest 500 schema messages instead of generic unavailable", () => {
    const msg =
      "Database schema is behind the API. Run `pnpm db:deploy` so migrations such as User.requestedRole are applied, then retry."
    assert.equal(friendlyHttpMessage(500, msg), msg)
  })

  it("falls back for empty 500", () => {
    assert.match(friendlyHttpMessage(500, ""), /server encountered an error/i)
  })

  it("uses generic copy for empty 503", () => {
    assert.match(friendlyHttpMessage(503, ""), /temporarily unavailable/i)
  })

  it("keeps Nest message on 401", () => {
    assert.equal(friendlyHttpMessage(401, "Invalid or expired token"), "Invalid or expired token")
  })
})

describe("profileLoadUserMessage", () => {
  it("maps network failures clearly", () => {
    assert.match(profileLoadUserMessage({ kind: "network", statusCode: 0, message: "x" }), /Unable to reach the server/)
  })

  it("surfaces API URL configuration errors without calling them unavailable", () => {
    const msg =
      'production builds reject non-HTTPS API URLs (got "http://localhost:4000"). Set EXPO_PUBLIC_API_URL to https://…'
    assert.equal(profileLoadUserMessage({ kind: "config", statusCode: 0, message: msg }), msg)
  })

  it("maps 404 profile missing", () => {
    assert.match(
      profileLoadUserMessage({ kind: "http", statusCode: 404, message: "" }),
      /application profile is not available/
    )
  })

  it("surfaces Nest 500 message", () => {
    assert.equal(
      profileLoadUserMessage({
        kind: "http",
        statusCode: 500,
        message: "Database schema is behind the API.",
      }),
      "Database schema is behind the API."
    )
  })
})
