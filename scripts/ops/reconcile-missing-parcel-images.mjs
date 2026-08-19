#!/usr/bin/env node
/**
 * Targeted parcel-image reconciliation: Convex storage → PostgreSQL photos → MinIO.
 *
 * Dry-run by default. Does not change parcel/ward/auth/survey/tax/workflow logic.
 *
 * Usage (from api-survey-apps):
 *   node scripts/ops/reconcile-missing-parcel-images.mjs --dry-run --legacy-ids <id1>,<id2>
 *   node scripts/ops/reconcile-missing-parcel-images.mjs --dry-run --ulb 801262 --ward 12
 *   node scripts/ops/reconcile-missing-parcel-images.mjs --apply --ulb 801262 --ward 12
 *   node scripts/ops/reconcile-missing-parcel-images.mjs --apply --create-missing-survey --legacy-ids <convexId>
 *
 * Requires CONVEX_SITE_URL + ETL_CONVEX_SECRET and DATABASE_URL.
 * MinIO is optional for classification; apply requires a reachable MINIO_ENDPOINT.
 */
import { randomBytes } from "node:crypto"
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "../../packages/database/node_modules/pg/lib/index.js"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "../..")
const workspaceLog = resolve("c:/sdv-books/projects/sdv-edutech-app/sdv-monorepo-apps/debug-25fc54.log")
const DEBUG_INGEST = "http://127.0.0.1:7681/ingest/0fc9f6c6-0c15-443b-bd77-d3106250dbc1"
const SESSION_ID = "25fc54"

loadEnvFiles([
  resolve(root, ".env.local"),
  resolve(root, ".env"),
  resolve(root, ".env.development"),
  resolve(root, "packages/database/.env"),
  resolve(root, "apps/api/.env.local"),
  resolve(root, "apps/api/.env.development"),
  resolve(root, "apps/worker/.env.local"),
  resolve(root, "apps/worker/.env.development"),
])
// Convex HTTP extract lives on the production site; take those secrets from
// .env.production without adopting compose hostnames (postgres / minio).
{
  const prod = parseEnvFile(resolve(root, ".env.production"))
  for (const key of ["CONVEX_SITE_URL", "ETL_CONVEX_SECRET", "ETL_SECRET"]) {
    if (prod[key]) process.env[key] = prod[key]
  }
}

const flags = parseFlags(process.argv.slice(2))
const dryRun = flags.apply !== true
const createMissingSurvey = flags["create-missing-survey"] === true
const ulbCode = String(flags.ulb ?? "").trim()
const wardNo = String(flags.ward ?? "").trim()
const legacyIds = String(flags["legacy-ids"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
const siteUrl = (process.env.CONVEX_SITE_URL || "").trim().replace(/\/+$/, "")
const etlSecret = (process.env.ETL_CONVEX_SECRET || process.env.ETL_SECRET || "").trim()
const dbUrl = process.env.DATABASE_URL

const SLOT_TO_PHOTO_TYPE = { front: "FRONT", side: "SIDE", inside: "INSIDE", document: "DOCUMENT" }
const PHOTO_TYPE_TO_SLOT = { FRONT: "front", SIDE: "side", INSIDE: "inside", DOCUMENT: "document" }

if (!siteUrl || !etlSecret) {
  console.error("CONVEX_SITE_URL and ETL_CONVEX_SECRET (or ETL_SECRET) required")
  process.exit(2)
}
if (!dbUrl) {
  console.error("DATABASE_URL missing")
  process.exit(2)
}
if (legacyIds.length === 0 && (!ulbCode || !wardNo)) {
  console.error("Pass --legacy-ids id1,id2 and/or both --ulb <code> --ward <n>")
  process.exit(2)
}

function parseFlags(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("--")) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith("--")) out[key] = true
    else {
      out[key] = next
      i += 1
    }
  }
  return out
}

function parseEnvFile(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function loadEnvFiles(paths) {
  for (const file of paths) {
    const parsed = parseEnvFile(file)
    for (const [key, val] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = val
    }
  }
}

function agentLog(hypothesisId, location, message, data) {
  const payload = {
    sessionId: SESSION_ID,
    runId: dryRun ? "dry-run" : "apply",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  }
  // #region agent log
  fetch(DEBUG_INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION_ID },
    body: JSON.stringify(payload),
  }).catch(() => { })
  try {
    appendFileSync(workspaceLog, `${JSON.stringify(payload)}\n`)
  } catch {
    /* ignore */
  }
  // #endregion
}

function dbHostInfo(url) {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/, "http:"))
    return { host: u.hostname, port: u.port || "5432", db: u.pathname.replace(/^\//, "") }
  } catch {
    return { host: "(unparseable)", port: "", db: "" }
  }
}

function sslFor(url) {
  const host = dbHostInfo(url).host
  if (["localhost", "127.0.0.1", "postgres"].includes(host)) return false
  return { rejectUnauthorized: false }
}

function bare(v) {
  return String(v ?? "").trim().replace(/^0+/, "") || "0"
}

function sanitizeSegment(value) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown"
}

function buildStorageKey({ districtCode, wardNo: ward, legacySurveyId, slot, extension }) {
  return `etah-images/district-${sanitizeSegment(districtCode)}/ward-${sanitizeSegment(ward)}/${sanitizeSegment(legacySurveyId)}/${slot}.${extension}`
}

function siblingKeys(key) {
  const match = key.match(/^(.*)\.([a-z0-9]+)$/i)
  if (!match) return [key]
  const base = match[1]
  return [...new Set([key, `${base}.jpg`, `${base}.jpeg`, `${base}.webp`, `${base}.png`])]
}

function wardVariants(ward) {
  const raw = String(ward ?? "").trim()
  const n = bare(raw)
  const out = new Set([raw, n].filter(Boolean))
  if (/^\d+$/.test(n)) {
    out.add(n.padStart(2, "0"))
    out.add(n.padStart(3, "0"))
  }
  return [...out]
}

function candidateKeys({ districtCode, districtName, wardNumber, legacySurveyId, slot, extension }) {
  const wards = wardVariants(wardNumber)
  const districts = [...new Set([districtCode, districtName].filter(Boolean))]
  const exts = [...new Set([extension, "jpg", "webp", "png"])]
  const keys = []
  for (const d of districts) {
    for (const w of wards) {
      for (const ext of exts) {
        keys.push(buildStorageKey({ districtCode: d, wardNo: w, legacySurveyId, slot, extension: ext }))
      }
    }
  }
  return [...new Set(keys)]
}

function detectMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg"
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png"
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp"
  }
  return null
}

function extFromMime(mime) {
  if (mime === "image/jpeg") return "jpg"
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  return "bin"
}

async function convexPost(path, body) {
  const res = await fetch(`${siteUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-ETL-Secret": etlSecret },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} ${res.status} ${text.slice(0, 240)}`)
  return JSON.parse(text)
}

async function loadS3Client() {
  const endpoint = (process.env.MINIO_ENDPOINT || process.env.AWS_S3_ENDPOINT || "").trim()
  const bucket = (process.env.MINIO_BUCKET || process.env.STORAGE_BUCKET || process.env.AWS_S3_BUCKET || "").trim()
  const accessKey = (process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || process.env.AWS_ACCESS_KEY_ID || "").trim()
  const secretKey = (
    process.env.MINIO_SECRET_KEY ||
    process.env.MINIO_ROOT_PASSWORD ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    ""
  ).trim()
  const region = (process.env.MINIO_REGION || process.env.AWS_REGION || "us-east-1").trim()
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    return { ok: false, reason: "minio_env_incomplete", bucket: bucket || null, endpointHost: endpoint || null }
  }
  let parsedHost = endpoint
  try {
    parsedHost = new URL(endpoint).hostname
  } catch {
    /* keep raw */
  }
  const require = createRequire(resolve(root, "apps/api/package.json"))
  try {
    const { S3Client, HeadObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3")
    const client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    })
    return { ok: true, client, bucket, HeadObjectCommand, PutObjectCommand, endpointHost: parsedHost }
  } catch (err) {
    return {
      ok: false,
      reason: `s3_sdk_unavailable: ${err instanceof Error ? err.message : String(err)}`.slice(0, 160),
      bucket,
      endpointHost: parsedHost,
    }
  }
}

async function headObject(s3, key) {
  if (!s3.ok) return { exists: null, error: s3.reason }
  try {
    const out = await s3.client.send(new s3.HeadObjectCommand({ Bucket: s3.bucket, Key: key }))
    return {
      exists: true,
      size: out.ContentLength ?? null,
      contentType: out.ContentType ?? null,
      lastModified: out.LastModified ? new Date(out.LastModified).toISOString() : null,
    }
  } catch (err) {
    const name = err?.name || ""
    const status = err?.$metadata?.httpStatusCode
    if (name === "NotFound" || status === 404) return { exists: false }
    return { exists: null, error: `${name || "HeadObjectError"} ${status || ""}`.trim() }
  }
}

async function findExistingObject(s3, keys) {
  for (const key of keys) {
    const head = await headObject(s3, key)
    if (head.exists === true) return { key, head }
    if (head.exists === null && head.error) return { key: null, head }
  }
  return { key: null, head: { exists: false } }
}

function classifyPhoto({ convexPhoto, nestPhoto, minioExists, minioKeyMatch }) {
  if (!convexPhoto?.url) return "unrecoverable_no_convex_url"
  if (!nestPhoto && minioExists === false) return "missing_pg_and_minio"
  if (!nestPhoto && minioExists === true) return "missing_pg_minio_present"
  if (!nestPhoto) return "missing_postgres_image_record"
  if (minioExists === false) return "missing_minio_object"
  if (minioExists === true && minioKeyMatch === false) return "wrong_object_key"
  if (minioExists === true) return "already_correct"
  return "minio_unverified"
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: sslFor(dbUrl),
  connectionTimeoutMillis: 20000,
})

let s3 = { ok: false, reason: "not_initialized" }

try {
  await client.connect()
} catch (err) {
  const info = dbHostInfo(dbUrl)
  agentLog("A", "reconcile-missing-parcel-images.mjs:connect", "Postgres connect failed", {
    host: info.host,
    error: err instanceof Error ? err.message : String(err),
  })
  console.error(`Postgres connect failed host=${info.host} port=${info.port}: ${err instanceof Error ? err.message : err}`)
  process.exit(2)
}

try {
  s3 = await loadS3Client()
  agentLog("B", "reconcile-missing-parcel-images.mjs:start", "Reconciliation start", {
    dryRun,
    ulbCode: ulbCode || null,
    wardNo: wardNo || null,
    legacyIdCount: legacyIds.length,
    db: dbHostInfo(dbUrl),
    minioOk: s3.ok,
    minioHost: s3.endpointHost ?? null,
    minioReason: s3.ok ? null : s3.reason,
    createMissingSurvey,
  })

  const nestRows = await loadNestSurveys(client, { legacyIds, ulbCode, wardNo })
  const nestByLegacy = new Map(nestRows.filter((r) => r.legacySurveyId).map((r) => [r.legacySurveyId, r]))

  let convexIds = legacyIds.length > 0 ? [...legacyIds] : nestRows.map((r) => r.legacySurveyId).filter(Boolean)
  if (legacyIds.length === 0 && ulbCode && wardNo) {
    convexIds = await listConvexIdsForWard(ulbCode, wardNo)
  }

  const bundles = await fetchBundles(convexIds)
  const photosBySurvey = await loadNestPhotos(
    client,
    nestRows.map((r) => r.id)
  )

  const totals = {
    surveysCompared: 0,
    alreadyCorrect: 0,
    missingPostgresImageRecord: 0,
    missingMinioObject: 0,
    missingPgAndMinio: 0,
    missingPgMinioPresent: 0,
    wrongObjectKey: 0,
    minioUnverified: 0,
    unrecoverable: 0,
    nestSurveyMissing: 0,
    duplicatePhotoType: 0,
  }
  const actions = []
  const csvRows = [
    "old_parcel_id,new_parcel_id,ward_id,legacy_survey_id,property_id,slot,old_storage_id,minio_bucket,minio_object_key,status,action",
  ]

  for (const bundle of bundles) {
    let nest = nestByLegacy.get(bundle._id)
    const convexPhotos = (bundle.photos || []).filter((p) => SLOT_TO_PHOTO_TYPE[p.slot])
    totals.surveysCompared += 1
    if (!nest) {
      totals.nestSurveyMissing += 1
      agentLog("E", "reconcile-missing-parcel-images.mjs:map", "Convex survey has no Nest row", {
        legacySurveyId: bundle._id,
        parcelNo: bundle.parcelNo ?? null,
        propertyId: bundle.propertyId ?? null,
        wardNo: bundle.wardNo ?? null,
        convexPhotoCount: convexPhotos.length,
        createMissingSurvey,
      })
      if (!createMissingSurvey) {
        for (const photo of convexPhotos) {
          csvRows.push(
            [
              bundle.parcelNo ?? "",
              "",
              bundle.wardNo ?? "",
              bundle._id,
              bundle.propertyId ?? "",
              photo.slot,
              photo.storageId ?? "",
              s3.bucket ?? "",
              "",
              "nest_survey_missing",
              "SKIP",
            ].join(",")
          )
        }
        continue
      }
      if (dryRun) {
        for (const photo of convexPhotos) {
          const preferredKey = buildStorageKey({
            districtCode: bundle.districtCode || "ETA",
            wardNo: bundle.wardNo || "12",
            legacySurveyId: bundle._id,
            slot: photo.slot,
            extension: guessExt(photo),
          })
          csvRows.push(
            [
              bundle.parcelNo ?? "",
              "",
              bundle.wardNo ?? "",
              bundle._id,
              bundle.propertyId ?? "",
              photo.slot,
              photo.storageId ?? "",
              s3.bucket ?? "",
              preferredKey,
              "nest_survey_missing",
              "create_survey_stub + upload + create_metadata",
            ]
              .map(csvEscape)
              .join(",")
          )
          actions.push({
            parcelNo: bundle.parcelNo,
            nestSurveyId: null,
            legacySurveyId: bundle._id,
            slot: photo.slot,
            oldStorageId: photo.storageId ?? null,
            nestPhotoId: null,
            nestObjectKey: null,
            minioExists: null,
            status: "nest_survey_missing",
            action: "create_survey_stub + upload + create_metadata",
          })
        }
        continue
      }
      nest = await createSurveyStub(client, bundle)
      nestByLegacy.set(bundle._id, nest)
      photosBySurvey.set(nest.id, [])
      agentLog("E", "reconcile-missing-parcel-images.mjs:createStub", "Created Nest survey stub for images", {
        nestId: nest.id,
        legacySurveyId: nest.legacySurveyId,
        parcelNumber: nest.parcelNumber,
        propertyId: nest.propertyId,
      })
    }

    const nestPhotos = photosBySurvey.get(nest.id) ?? []
    const byType = new Map()
    for (const p of nestPhotos) {
      const list = byType.get(p.photoType) ?? []
      list.push(p)
      byType.set(p.photoType, list)
    }

    for (const convexPhoto of convexPhotos) {
      const photoType = SLOT_TO_PHOTO_TYPE[convexPhoto.slot]
      const nestMatches = byType.get(photoType) ?? []
      if (nestMatches.length > 1) totals.duplicatePhotoType += 1
      const nestPhoto = nestMatches[0] ?? null
      const expectedExt = guessExt(convexPhoto)
      const keys = candidateKeys({
        districtCode: nest.districtCode || bundle.districtCode || "ETA",
        districtName: nest.districtName || bundle.districtName,
        wardNumber: nest.wardNumber || bundle.wardNo,
        legacySurveyId: bundle._id,
        slot: convexPhoto.slot,
        extension: expectedExt,
      })
      if (nestPhoto?.objectKey) keys.unshift(nestPhoto.objectKey)
      if (nestPhoto?.url && !/^https?:/i.test(nestPhoto.url)) keys.unshift(nestPhoto.url)
      const uniqueKeys = [...new Set(keys)]
      const found = await findExistingObject(s3, uniqueKeys)
      const minioExists = found.head.exists
      const preferredKey =
        nestPhoto?.objectKey ||
        found.key ||
        buildStorageKey({
          districtCode: nest.districtCode || bundle.districtCode || "ETA",
          wardNo: nest.wardNumber || bundle.wardNo || "unknown",
          legacySurveyId: bundle._id,
          slot: convexPhoto.slot,
          extension: expectedExt,
        })
      const minioKeyMatch = Boolean(nestPhoto?.objectKey && found.key && nestPhoto.objectKey === found.key)
      const status = classifyPhoto({
        convexPhoto,
        nestPhoto,
        minioExists,
        minioKeyMatch: nestPhoto?.objectKey ? minioKeyMatch || found.key === nestPhoto.objectKey : minioExists === true,
      })

      if (status === "already_correct") totals.alreadyCorrect += 1
      else if (status === "missing_postgres_image_record") totals.missingPostgresImageRecord += 1
      else if (status === "missing_minio_object") totals.missingMinioObject += 1
      else if (status === "missing_pg_and_minio") totals.missingPgAndMinio += 1
      else if (status === "missing_pg_minio_present") totals.missingPgMinioPresent += 1
      else if (status === "wrong_object_key") totals.wrongObjectKey += 1
      else if (status === "minio_unverified") totals.minioUnverified += 1
      else totals.unrecoverable += 1

      const needsUpload = status === "missing_minio_object" || status === "missing_pg_and_minio"
      const needsPg =
        status === "missing_postgres_image_record" ||
        status === "missing_pg_and_minio" ||
        status === "missing_pg_minio_present"
      const action =
        status === "already_correct" || status === "minio_unverified" && nestPhoto
          ? "SKIP"
          : status.startsWith("unrecoverable")
            ? "UNRECOVERABLE"
            : [needsUpload ? "upload" : null, needsPg ? "create_metadata" : null].filter(Boolean).join(" + ") || "SKIP"

      const row = {
        parcelNo: nest.parcelNumber ?? bundle.parcelNo,
        nestSurveyId: nest.id,
        legacySurveyId: bundle._id,
        wardId: nest.wardId,
        wardNumber: nest.wardNumber,
        propertyId: nest.propertyId,
        slot: convexPhoto.slot,
        photoType,
        oldStorageId: convexPhoto.storageId ?? null,
        convexUrlHost: convexPhoto.url && /^https?:/i.test(convexPhoto.url) ? new URL(convexPhoto.url).hostname : null,
        nestPhotoId: nestPhoto?.id ?? null,
        nestObjectKey: nestPhoto?.objectKey ?? null,
        preferredKey,
        minioExists,
        minioFoundKey: found.key,
        minioSize: found.head.size ?? null,
        migStatus: nest.migStatus,
        imagesImported: nest.imagesImported,
        imagesExpected: nest.imagesExpected,
        status,
        action,
      }
      actions.push(row)
      csvRows.push(
        [
          bundle.parcelNo ?? "",
          nest.id,
          nest.wardId,
          bundle._id,
          nest.propertyId ?? "",
          convexPhoto.slot,
          convexPhoto.storageId ?? "",
          s3.bucket ?? "",
          preferredKey,
          status,
          action,
        ]
          .map(csvEscape)
          .join(",")
      )

      if (["k970djzvy9cbnxewwdc36d9yj98bg13r", "k975s0a9rhftm537r6b77v88sx8bhv66"].includes(bundle._id)) {
        agentLog(status === "already_correct" ? "G" : "A", "reconcile-missing-parcel-images.mjs:compare", "Reference parcel photo", row)
      }

      if (!dryRun && action !== "SKIP" && action !== "UNRECOVERABLE") {
        await applyRepair({ s3, client, nest, convexPhoto, photoType, preferredKey, needsUpload, needsPg, nestPhoto })
      }
    }
  }

  const reportDir = resolve(root, "scripts/ops/reports")
  mkdirSync(reportDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const csvPath = resolve(reportDir, `image-reconciliation-${stamp}.csv`)
  writeFileSync(csvPath, `${csvRows.join("\n")}\n`)

  const affected =
    totals.missingPostgresImageRecord +
    totals.missingMinioObject +
    totals.missingPgAndMinio +
    totals.missingPgMinioPresent +
    totals.wrongObjectKey
  const summary = {
    mode: dryRun ? "dry-run" : "apply",
    db: dbHostInfo(dbUrl),
    minio: { reachable: s3.ok, host: s3.endpointHost ?? null, bucket: s3.bucket ?? null, reason: s3.ok ? null : s3.reason },
    surveysCompared: totals.surveysCompared,
    nestSurveyMissing: totals.nestSurveyMissing,
    alreadyCorrect: totals.alreadyCorrect,
    missingPostgresImageRecord: totals.missingPostgresImageRecord,
    missingMinioObject: totals.missingMinioObject,
    missingPgAndMinio: totals.missingPgAndMinio,
    missingPgMinioPresent: totals.missingPgMinioPresent,
    wrongObjectKey: totals.wrongObjectKey,
    minioUnverified: totals.minioUnverified,
    unrecoverable: totals.unrecoverable,
    duplicatePhotoType: totals.duplicatePhotoType,
    affectedSlots: affected,
    csvPath,
  }
  agentLog("G", "reconcile-missing-parcel-images.mjs:summary", "Reconciliation summary", summary)

  console.log("\n=== Parcel image reconciliation ===")
  console.log(`Mode: ${summary.mode}`)
  console.log(`Surveys compared: ${totals.surveysCompared}`)
  console.log(`Nest survey missing (Convex only): ${totals.nestSurveyMissing}`)
  console.log(`Already correct: ${totals.alreadyCorrect}`)
  console.log(`Missing PostgreSQL image record: ${totals.missingPostgresImageRecord}`)
  console.log(`Missing MinIO object: ${totals.missingMinioObject}`)
  console.log(`Missing PG + MinIO: ${totals.missingPgAndMinio}`)
  console.log(`MinIO present / PG missing: ${totals.missingPgMinioPresent}`)
  console.log(`Wrong object key: ${totals.wrongObjectKey}`)
  console.log(`MinIO unverified: ${totals.minioUnverified}`)
  console.log(`Unrecoverable: ${totals.unrecoverable}`)
  console.log(`Duplicate photoType rows: ${totals.duplicatePhotoType}`)
  console.log(`CSV: ${csvPath}`)
  if (dryRun) {
    console.log("\nNo database changes made.")
    console.log("No MinIO changes made.")
  }

  const interesting = actions.filter((a) => a.action !== "SKIP").slice(0, 40)
  for (const a of interesting) {
    console.log(
      `\nParcel ${a.parcelNo} / ${a.legacySurveyId} / ${a.slot}:\n  old storageId=${a.oldStorageId}\n  nest photo=${a.nestPhotoId ?? "(none)"}\n  nest key=${a.nestObjectKey ?? "(none)"}\n  minio exists=${a.minioExists}\n  ACTION: ${a.action} (${a.status})`
    )
  }
} finally {
  await client.end().catch(() => { })
}

async function loadNestSurveys(db, { legacyIds, ulbCode, wardNo }) {
  const params = []
  const where = [`s."deletedAt" IS NULL`]
  if (legacyIds.length > 0) {
    params.push(legacyIds)
    where.push(`s."legacySurveyId" = ANY($${params.length})`)
  }
  if (ulbCode) {
    params.push(ulbCode)
    where.push(`s."ulbCode" = $${params.length}`)
  }
  if (wardNo) {
    params.push(bare(wardNo))
    where.push(`regexp_replace(coalesce(s."wardNumber", ''), '^0+', '') = $${params.length}`)
  }
  const sql = `
    SELECT s.id, s."legacySurveyId" AS "legacySurveyId", s."parcelNumber" AS "parcelNumber",
           s."propertyId" AS "propertyId", s."wardNumber" AS "wardNumber", s."wardId" AS "wardId",
           s."ulbCode" AS "ulbCode", d.code AS "districtCode", d.name AS "districtName",
           ms.status::text AS "migStatus", ms."imagesImported" AS "imagesImported",
           ms."imagesExpected" AS "imagesExpected"
    FROM surveys s
    JOIN districts d ON d.id = s."districtId"
    LEFT JOIN migration_state ms ON ms."legacySurveyId" = s."legacySurveyId"
    WHERE ${where.join(" AND ")}
    ORDER BY s."parcelNumber" NULLS LAST, s.id
  `
  const result = await db.query(sql, params)
  return result.rows
}

async function loadNestPhotos(db, surveyIds) {
  const map = new Map()
  if (surveyIds.length === 0) return map
  const result = await db.query(
    `
    SELECT id, "surveyId", "photoType"::text AS "photoType", "objectKey", bucket, url,
           "sourceUrl", "importStatus", "sizeBytes"
    FROM photos
    WHERE "surveyId" = ANY($1)
    ORDER BY "photoType", "createdAt"
    `,
    [surveyIds]
  )
  for (const row of result.rows) {
    const list = map.get(row.surveyId) ?? []
    list.push(row)
    map.set(row.surveyId, list)
  }
  return map
}

async function listConvexIdsForWard(muni, ward) {
  const ids = []
  let cursor = null
  let isDone = false
  while (!isDone) {
    const page = await convexPost("/etl/list-survey-ids", {
      cursor,
      numItems: 200,
      statuses: ["draft", "submitted", "approved", "rejected"],
    })
    for (let i = 0; i < page.ids.length; i += 50) {
      const chunk = page.ids.slice(i, i + 50)
      if (chunk.length === 0) continue
      const result = await convexPost("/etl/get-survey-bundles", { ids: chunk })
      for (const b of result.bundles || []) {
        if (b.municipalityCode !== muni) continue
        if (bare(b.wardNo) !== bare(ward)) continue
        ids.push(b._id)
      }
    }
    cursor = page.continueCursor
    isDone = page.isDone
  }
  return ids
}

async function fetchBundles(ids) {
  const unique = [...new Set(ids)]
  const bundles = []
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50)
    const result = await convexPost("/etl/get-survey-bundles", { ids: chunk })
    bundles.push(...(result.bundles || []))
  }
  return bundles
}

function guessExt(photo) {
  const url = String(photo.url ?? "")
  const m = url.match(/\.([a-z0-9]+)(?:\?|$)/i)
  if (m && ["jpg", "jpeg", "png", "webp"].includes(m[1].toLowerCase())) {
    return m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase()
  }
  return "jpg"
}

function csvEscape(value) {
  const s = String(value ?? "")
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function createSurveyStub(db, bundle) {
  const ulbCode = String(bundle.municipalityCode ?? "").trim()
  const wardBare = bare(bundle.wardNo)
  const donor = await db.query(
    `
    SELECT s."stateId", s."districtId", s."ulbId", s."wardId", s."createdById",
           s."assessmentYear"::text AS "assessmentYear",
           s."ulbCode", d.code AS "districtCode", d.name AS "districtName",
           s."wardNumber" AS "wardNumber"
    FROM surveys s
    JOIN districts d ON d.id = s."districtId"
    WHERE s."ulbCode" = $1
      AND regexp_replace(coalesce(s."wardNumber", ''), '^0+', '') = $2
      AND s."deletedAt" IS NULL
    LIMIT 1
    `,
    [ulbCode, wardBare]
  )
  const geo = donor.rows[0]
  if (!geo) {
    throw new Error(`No donor Nest survey for ulb=${ulbCode} ward=${wardBare} to attach images`)
  }
  const propertyId = (bundle.propertyId || bundle.parcelNo || bundle._id).toString().trim()
  const parcelNumber = bundle.parcelNo?.toString().trim() || null
  const inserted = await db.query(
    `
    INSERT INTO surveys (
      id, "stateId", "districtId", "ulbId", "wardId", "createdById",
      "propertyId", "parcelNumber", "legacySurveyId", "localId",
      "wardNumber", "ulbCode", "districtName",
      "assessmentYear", "surveyStatus", "qcStatus",
      "isSlum", "serverVersion", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text, $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12,
      $13::"AssessmentYear", 'SUBMITTED'::"SurveyStatus", 'PENDING'::"QcStatus",
      false, 1, NOW(), NOW()
    )
    RETURNING id, "legacySurveyId" AS "legacySurveyId", "parcelNumber" AS "parcelNumber",
              "propertyId" AS "propertyId", "wardNumber" AS "wardNumber", "wardId" AS "wardId",
              "ulbCode" AS "ulbCode", $14 AS "districtCode", $12 AS "districtName",
              NULL AS "migStatus", 0 AS "imagesImported", 0 AS "imagesExpected"
    `,
    [
      geo.stateId,
      geo.districtId,
      geo.ulbId,
      geo.wardId,
      geo.createdById,
      propertyId,
      parcelNumber,
      bundle._id,
      null,
      String(bundle.wardNo ?? geo.wardNumber ?? wardBare),
      ulbCode,
      geo.districtName,
      geo.assessmentYear,
      geo.districtCode,
    ]
  )
  return inserted.rows[0]
}

async function applyRepair({ s3, client: db, nest, convexPhoto, photoType, preferredKey, needsUpload, needsPg, nestPhoto }) {
  if (needsUpload) {
    if (!s3.ok) throw new Error("MinIO not reachable; refuse apply")
    if (!convexPhoto.url) throw new Error("No Convex URL to download")
    const existing = await headObject(s3, preferredKey)
    if (existing.exists !== true) {
      const res = await fetch(convexPhoto.url)
      if (!res.ok) throw new Error(`Download failed ${res.status}`)
      const buffer = Buffer.from(await res.arrayBuffer())
      const mime = detectMime(buffer)
      if (!mime) throw new Error("Unable to detect image MIME")
      await s3.client.send(
        new s3.PutObjectCommand({
          Bucket: s3.bucket,
          Key: preferredKey,
          Body: buffer,
          ContentType: mime,
          Metadata: {
            legacySurveyId: nest.legacySurveyId,
            slot: convexPhoto.slot,
            source: "image-reconciliation",
          },
        })
      )
    }
  }
  if (needsPg && !nestPhoto) {
    const head = s3.ok ? await headObject(s3, preferredKey) : { exists: null, size: null, contentType: null }
    await db.query(
      `
      INSERT INTO photos (
        id, "surveyId", "photoType", url, "sourceUrl", "objectKey", bucket,
        "storageProvider", "mimeType", "sizeBytes", "sizeKB", "importStatus", "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2, $3::"PhotoType", $4, $5, $4, $6,
        'MINIO'::"StorageProvider", $7, $8, $9, 'SUCCEEDED', NOW(), NOW()
      )
      `,
      [
        `imgrec_${randomBytes(12).toString("hex")}`,
        nest.id,
        photoType,
        preferredKey,
        String(convexPhoto.url ?? "").slice(0, 2000),
        s3.bucket ?? null,
        head.contentType ?? "image/jpeg",
        head.size ?? null,
        head.size != null ? Math.ceil(head.size / 1024) : null,
      ]
    )
  }
}
