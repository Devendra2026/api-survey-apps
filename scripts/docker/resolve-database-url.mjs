#!/usr/bin/env node
/**
 * Resolve DATABASE_URL for Docker entrypoints.
 *
 * Rules (stdout = connection string only; never log secrets):
 * - If DATABASE_URL or DIRECT_URL points at a non-compose host → use it (external DB).
 * - Otherwise build from POSTGRES_* with encodeURIComponent (single source of truth).
 *
 * Usage: DATABASE_URL="$(node resolve-database-url.mjs)"
 */
function hostnameOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ""
  }
}

function fail(message) {
  console.error(`resolve-database-url: ${message}`)
  process.exit(1)
}

const direct = process.env.DIRECT_URL?.trim() || ""
const databaseUrl = process.env.DATABASE_URL?.trim() || ""
const existing = direct || databaseUrl
const composeHost = (process.env.POSTGRES_HOST || "postgres").trim() || "postgres"

if (existing) {
  const host = hostnameOf(existing)
  if (!host) {
    fail("DATABASE_URL/DIRECT_URL is not a valid URL")
  }
  if (host !== composeHost && host !== "localhost" && host !== "127.0.0.1") {
    // External / managed Postgres — keep operator-provided URL.
    process.stdout.write(existing)
    process.exit(0)
  }
}

const user = (process.env.POSTGRES_USER || "postgres").trim() || "postgres"
const password = process.env.POSTGRES_PASSWORD ?? ""
const database = (process.env.POSTGRES_DB || "survey").trim() || "survey"
const port = (process.env.POSTGRES_PORT || "5432").trim() || "5432"
const schema = (process.env.POSTGRES_SCHEMA || "public").trim() || "public"

if (!password) {
  fail(
    "POSTGRES_PASSWORD is required to build DATABASE_URL for in-compose Postgres (host `" +
    composeHost +
    "`). Set it in Dokploy Environment.",
  )
}

if (password.includes("REPLACE_ME")) {
  fail("POSTGRES_PASSWORD still contains REPLACE_ME_* — set the real password before deploy.")
}

if (user.includes("REPLACE_ME") || database.includes("REPLACE_ME")) {
  fail("POSTGRES_USER/POSTGRES_DB still contains REPLACE_ME_* placeholders.")
}

const url =
  `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
  `@${composeHost}:${port}/${encodeURIComponent(database)}` +
  `?schema=${encodeURIComponent(schema)}`

process.stdout.write(url)
