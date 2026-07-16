/**
 * Verify NEXT_PUBLIC_GOOGLE_MAPS_API_KEY against Maps Embed API
 * (used by the GIS map UI) and Maps Static API.
 *
 * Env precedence (same as Next.js / Nest): .env.local → .env.development → .env
 *
 * Usage:
 *   npm run verify:google-maps-key
 *   npm run verify:google-maps-key -- --referer http://localhost:3000/
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENV_CANDIDATES = [".env.local", ".env.development", ".env"];

let failed = false;

function fail(msg) {
  console.error(`[verify-google-maps-key] ${msg}`);
  failed = true;
}

function ok(msg) {
  console.log(`[verify-google-maps-key] OK — ${msg}`);
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const text = readFileSync(filePath, "utf8");
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    value = value.replace(/^["']|["']$/g, "");
    out[key] = value;
  }
  return out;
}

/**
 * First non-empty value wins across candidates (local overrides development).
 * @param {string} key
 * @returns {{ value: string | null, source: string | null }}
 */
function readEnv(key) {
  for (const name of ENV_CANDIDATES) {
    const filePath = path.join(root, name);
    const map = parseEnvFile(filePath);
    const value = map[key]?.trim();
    if (value) return { value, source: name };
  }
  return { value: null, source: null };
}

function warnAppWebOverride() {
  const webEnv = path.join(root, "apps", "web", ".env.local");
  if (!existsSync(webEnv)) return;
  const map = parseEnvFile(webEnv);
  const webKey = map.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!webKey) return;
  console.warn(
    "[verify-google-maps-key] WARNING — apps/web/.env.local also sets NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.",
  );
  console.warn(
    "  Next.js may prefer that value over the repo-root key and break GIS embeds.",
  );
  console.warn(
    "  Remove the Maps key from apps/web/.env.local; keep it only in repo-root .env.local.",
  );
}

function parseArgs(argv) {
  /** @type {{ referer: string | null }} */
  const opts = { referer: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--referer" || arg === "--referrer") {
      opts.referer = argv[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith("--referer=")) {
      opts.referer = arg.slice("--referer=".length);
    } else if (arg.startsWith("--referrer=")) {
      opts.referer = arg.slice("--referrer=".length);
    }
  }
  return opts;
}

function printFixSteps() {
  console.log("\nFix in Google Cloud Console (same project as your API key):");
  console.log("  1. Enable billing: https://console.cloud.google.com/billing");
  console.log("  2. Enable APIs: Maps Embed API (required for GIS map) + Maps Static API");
  console.log("     https://console.cloud.google.com/google/maps-apis/api-list");
  console.log("  3. API key HTTP referrers (for browser embeds):");
  console.log("     http://localhost:3000/*");
  console.log("     http://127.0.0.1:3000/*");
  console.log("     https://*.vercel.app/*");
  console.log("     https://YOUR-PRODUCTION-DOMAIN/*");
  console.log("  4. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in repo-root .env.local only");
  console.log("     (do not set a different key in apps/web/.env.local)");
  console.log("  5. Restart the web dev server after changing env (clear apps/web/.next if needed)");
  console.log("  6. Re-run: npm run verify:google-maps-key");
  console.log("     Optional: npm run verify:google-maps-key -- --referer http://localhost:3000/\n");
}

function classifyError(body, status) {
  if (body.includes("InvalidKeyMapError") || body.includes("The provided API key is invalid")) {
    fail("Invalid API key — create/replace the key in Google Cloud and update repo-root .env.local");
  } else if (body.includes("enable Billing") || body.toLowerCase().includes("billing")) {
    fail("Billing is not enabled on this Google Cloud project");
    console.error("  Enable billing: https://console.cloud.google.com/billing/enable");
  } else if (
    body.includes("REQUEST_DENIED") ||
    body.includes("ApiNotActivatedMapError") ||
    body.includes("API keys with referer") ||
    body.includes("RefererNotAllowedMapError")
  ) {
    fail("REQUEST_DENIED — check enabled APIs (Maps Embed API), billing, and key restrictions");
    if (body.toLowerCase().includes("referer") || body.toLowerCase().includes("referrer")) {
      console.error(
        "  Hint: add http://localhost:3000/* and http://127.0.0.1:3000/* as HTTP referrers.",
      );
    }
  } else if (body.includes("OVER_QUERY_LIMIT")) {
    fail("OVER_QUERY_LIMIT — quota exceeded");
  } else {
    fail(`Unexpected response (${status}): ${body.slice(0, 240)}`);
  }
}

/**
 * @param {string} key
 * @param {number} lat
 * @param {number} lng
 * @param {string | null} referer
 */
async function checkEmbedApi(key, lat, lng, referer) {
  const url =
    `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}` +
    `&q=${encodeURIComponent(`${lat},${lng}`)}&zoom=17`;

  try {
    /** @type {Record<string, string>} */
    const headers = {};
    if (referer) headers.Referer = referer;

    const res = await fetch(url, { method: "GET", redirect: "follow", headers });
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();

    const looksLikeError =
      body.includes("ApiNotActivatedMapError") ||
      body.includes("InvalidKeyMapError") ||
      body.includes("RefererNotAllowedMapError") ||
      body.includes("REQUEST_DENIED") ||
      body.includes("The provided API key is invalid") ||
      (body.includes("The Google Maps Embed API") && body.includes("error"));

    if (res.ok && contentType.includes("text/html") && !looksLikeError) {
      const suffix = referer ? ` (Referer: ${referer})` : "";
      ok(`Maps Embed API responded with embed HTML${suffix}`);
      return true;
    }

    classifyError(body || `HTTP ${res.status}`, res.status);
    return false;
  } catch (err) {
    fail(`Embed API network error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function checkStaticApi(key, lat, lng) {
  const url =
    `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
    `&zoom=14&size=200x200&markers=color:red%7C${lat},${lng}&key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, { method: "GET" });
    const contentType = res.headers.get("content-type") ?? "";

    if (res.ok && contentType.startsWith("image/")) {
      ok("Maps Static API responded with an image");
      return true;
    }

    const body = await res.text();
    classifyError(body, res.status);
    return false;
  } catch (err) {
    fail(`Static API network error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function main() {
  const { referer } = parseArgs(process.argv.slice(2));
  warnAppWebOverride();

  const { value: key, source } = readEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  if (!key) {
    fail("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set in .env.local / .env.development / .env");
    printFixSteps();
    return 1;
  }

  ok(`Key present from ${source} (${key.slice(0, 4)}…${key.slice(-4)})`);

  const testLat = 28.6139;
  const testLng = 77.209;

  const embedOk = await checkEmbedApi(key, testLat, testLng, null);

  if (referer) {
    const refererOk = await checkEmbedApi(key, testLat, testLng, referer);
    if (!refererOk) {
      console.error(
        `\nReferer check failed for ${referer}. Add this pattern to the API key HTTP referrer restrictions.`,
      );
      if (failed) printFixSteps();
      return 1;
    }
  }

  // Static is secondary; failure after Embed success is a soft warning for print/PDF use.
  const staticOk = await checkStaticApi(key, testLat, testLng);

  if (embedOk && staticOk) {
    console.log("\nGoogle Maps key is valid for Embed (GIS map) and Static Maps.\n");
    return 0;
  }

  if (embedOk && !staticOk) {
    console.log(
      "\nEmbed API works (GIS map OK). Static Maps failed — enable Maps Static API if you need print/PDF maps.\n",
    );
    // Embed is what the UI needs; treat as success for the main use case.
    return 0;
  }

  if (failed) printFixSteps();
  return 1;
}

const code = await main();
process.exitCode = code;
