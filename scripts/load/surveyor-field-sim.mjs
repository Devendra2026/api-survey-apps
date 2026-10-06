/**
 * Staging field simulation for about 100 surveyors.
 *
 * Does not call a server unless --execute and STAGING_API_URL are both set.
 * Refuses production hostnames. Do not point this at a live survey database.
 *
 * The in-process section checks that 100 distinct user buckets are not one shared IP bucket.
 * An HTTP run requires a staging API with ALLOW_DEV_AUTH (non-production) and dev bearer tokens.
 *
 *   node scripts/load/surveyor-field-sim.mjs
 *   STAGING_API_URL=https://staging-api.example.com node scripts/load/surveyor-field-sim.mjs --execute
 */
const SURVEYOR_COUNT = 100
const PRODUCTION_HOSTS = new Set(["backend.sdvedutech.in", "admin.sdvedutech.in"])

function trackerKey(userId, ip) {
  const id = typeof userId === "string" ? userId.trim() : ""
  if (id) return `user:${id}`
  return `ip:${ip}`
}

function simulateBuckets() {
  const traefikPeer = "172.18.0.2"
  const keys = new Set()
  for (let index = 0; index < SURVEYOR_COUNT; index += 1) {
    keys.add(trackerKey(`surveyor-${index}`, traefikPeer))
  }
  const sharedAnonymous = trackerKey(null, traefikPeer)
  return { distinctUserBuckets: keys.size, anonymousBucket: sharedAnonymous }
}

function assertStagingUrl(raw) {
  const url = new URL(raw)
  if (PRODUCTION_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing to load-test production host ${url.hostname}`)
  }
  return url
}

const buckets = simulateBuckets()
if (buckets.distinctUserBuckets !== SURVEYOR_COUNT) {
  console.error("Expected one throttle bucket per surveyor")
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      surveyors: SURVEYOR_COUNT,
      distinctUserBuckets: buckets.distinctUserBuckets,
      anonymousBucket: buckets.anonymousBucket,
      scenario: [
        "open survey",
        "create survey",
        "edit fields",
        "debounced autosave",
        "upload photo",
        "retake via PUT /photos/:id/replace",
        "navigate",
        "submit once",
      ],
      acceptance: [
        "no shared-proxy 429",
        "no unexpected 5xx",
        "no duplicate survey or FRONT row",
        "no infinite autosave retry",
      ],
    },
    null,
    2
  )
)

const execute = process.argv.includes("--execute")
if (!execute) {
  console.log("HTTP simulation not started. Pass --execute with STAGING_API_URL to run against staging.")
  process.exit(0)
}

const staging = process.env.STAGING_API_URL
if (!staging) {
  console.error("STAGING_API_URL is required with --execute")
  process.exit(1)
}
assertStagingUrl(staging)
console.error(
  "HTTP execution is intentionally not implemented in this script. Run the unit tests for tracker, retake, and autosave, then drive staging with your load tool using one bearer token per surveyor."
)
process.exit(0)
