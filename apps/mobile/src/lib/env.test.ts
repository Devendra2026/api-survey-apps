import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ApiUrlConfigurationError,
  resolveApiBaseUrl,
  rewriteAndroidEmulatorLoopback,
} from "./api-base-url.ts"

describe("rewriteAndroidEmulatorLoopback", () => {
  it("rewrites localhost to 10.0.2.2 on Android emulator", () => {
    assert.equal(
      rewriteAndroidEmulatorLoopback("http://localhost:4000", {
        platform: "android",
        isDevice: false,
      }),
      "http://10.0.2.2:4000"
    )
  })

  it("leaves LAN and HTTPS URLs unchanged", () => {
    assert.equal(
      rewriteAndroidEmulatorLoopback("http://192.168.1.20:4000", {
        platform: "android",
        isDevice: false,
      }),
      "http://192.168.1.20:4000"
    )
    assert.equal(
      rewriteAndroidEmulatorLoopback("https://backend.example.com", {
        platform: "android",
        isDevice: false,
      }),
      "https://backend.example.com"
    )
  })

  it("does not rewrite on physical Android devices", () => {
    assert.equal(
      rewriteAndroidEmulatorLoopback("http://localhost:4000", {
        platform: "android",
        isDevice: true,
      }),
      "http://localhost:4000"
    )
  })
})

describe("resolveApiBaseUrl — development", () => {
  it("uses env URL in development, rewriting Android emulator loopback", () => {
    assert.equal(
      resolveApiBaseUrl({
        appEnv: "development",
        apiUrl: "http://localhost:4000",
        platform: "android",
        isDevice: false,
        defaultUrl: "http://10.0.2.2:4000",
      }),
      "http://10.0.2.2:4000"
    )
  })

  it("falls back to default URL in development when env unset", () => {
    assert.equal(
      resolveApiBaseUrl({
        appEnv: "development",
        apiUrl: undefined,
        platform: "ios",
        isDevice: false,
        defaultUrl: "http://localhost:4000",
      }),
      "http://localhost:4000"
    )
  })

  it("allows physical-device LAN HTTP in development", () => {
    assert.equal(
      resolveApiBaseUrl({
        appEnv: "development",
        apiUrl: "http://192.168.1.20:4000",
        platform: "android",
        isDevice: true,
        defaultUrl: "http://10.0.2.2:4000",
      }),
      "http://192.168.1.20:4000"
    )
  })

  it("throws on empty string URL when provided in development", () => {
    // Empty string is treated as unset → defaultUrl
    assert.equal(
      resolveApiBaseUrl({
        appEnv: "development",
        apiUrl: "   ",
        platform: "ios",
        isDevice: false,
        defaultUrl: "http://localhost:4000",
      }),
      "http://localhost:4000"
    )
  })

  it("throws on invalid URL in development when set", () => {
    assert.throws(
      () =>
        resolveApiBaseUrl({
          appEnv: "development",
          apiUrl: "not-a-url",
          platform: "ios",
          isDevice: false,
          defaultUrl: "http://localhost:4000",
        }),
      (err: unknown) =>
        err instanceof ApiUrlConfigurationError && /not a valid URL/i.test(err.message)
    )
  })

  it("strips trailing slash", () => {
    assert.equal(
      resolveApiBaseUrl({
        appEnv: "development",
        apiUrl: "http://10.0.2.2:4000/",
        platform: "android",
        isDevice: false,
        defaultUrl: "http://10.0.2.2:4000",
      }),
      "http://10.0.2.2:4000"
    )
  })
})

describe("resolveApiBaseUrl — preview", () => {
  it("requires HTTPS and rejects localhost / emulator / http", () => {
    assert.throws(
      () =>
        resolveApiBaseUrl({
          appEnv: "preview",
          apiUrl: "http://10.0.2.2:4000",
          platform: "android",
          isDevice: false,
          defaultUrl: "http://10.0.2.2:4000",
        }),
      ApiUrlConfigurationError
    )
    assert.throws(
      () =>
        resolveApiBaseUrl({
          appEnv: "preview",
          apiUrl: "https://localhost:4000",
          platform: "ios",
          isDevice: false,
          defaultUrl: "http://localhost:4000",
        }),
      ApiUrlConfigurationError
    )
    assert.throws(
      () =>
        resolveApiBaseUrl({
          appEnv: "preview",
          apiUrl: undefined,
          platform: "android",
          isDevice: true,
          defaultUrl: "https://backend.sdvedutech.in",
        }),
      (err: unknown) =>
        err instanceof ApiUrlConfigurationError && /required for preview/i.test(err.message)
    )
  })

  it("accepts HTTPS staging URL and does not invent production default", () => {
    assert.equal(
      resolveApiBaseUrl({
        appEnv: "preview",
        apiUrl: "https://api-preview.example.com/",
        platform: "android",
        isDevice: true,
        defaultUrl: "https://backend.sdvedutech.in",
      }),
      "https://api-preview.example.com"
    )
  })
})

describe("resolveApiBaseUrl — production", () => {
  it("throws on missing API URL", () => {
    assert.throws(
      () =>
        resolveApiBaseUrl({
          appEnv: "production",
          apiUrl: undefined,
          platform: "android",
          isDevice: true,
          defaultUrl: "http://10.0.2.2:4000",
        }),
      (err: unknown) =>
        err instanceof ApiUrlConfigurationError && /required for production/i.test(err.message)
    )
  })

  it("throws on http://localhost:4000", () => {
    assert.throws(
      () =>
        resolveApiBaseUrl({
          appEnv: "production",
          apiUrl: "http://localhost:4000",
          platform: "android",
          isDevice: true,
          defaultUrl: "http://10.0.2.2:4000",
        }),
      (err: unknown) =>
        err instanceof ApiUrlConfigurationError && /non-HTTPS|reject/i.test(err.message)
    )
  })

  it("throws on empty URL", () => {
    assert.throws(
      () =>
        resolveApiBaseUrl({
          appEnv: "production",
          apiUrl: "",
          platform: "ios",
          isDevice: true,
          defaultUrl: "https://backend.sdvedutech.in",
        }),
      ApiUrlConfigurationError
    )
  })

  it("throws on invalid URL", () => {
    assert.throws(
      () =>
        resolveApiBaseUrl({
          appEnv: "production",
          apiUrl: "://bad",
          platform: "ios",
          isDevice: true,
          defaultUrl: "https://backend.sdvedutech.in",
        }),
      ApiUrlConfigurationError
    )
  })

  it("accepts https://backend.sdvedutech.in with trailing slash normalization", () => {
    assert.equal(
      resolveApiBaseUrl({
        appEnv: "production",
        apiUrl: "https://backend.sdvedutech.in/",
        platform: "android",
        isDevice: true,
        defaultUrl: "http://10.0.2.2:4000",
      }),
      "https://backend.sdvedutech.in"
    )
  })

  it("rejects https://127.0.0.1", () => {
    assert.throws(
      () =>
        resolveApiBaseUrl({
          appEnv: "production",
          apiUrl: "https://127.0.0.1:4000",
          platform: "android",
          isDevice: true,
          defaultUrl: "https://backend.sdvedutech.in",
        }),
      ApiUrlConfigurationError
    )
  })
})
