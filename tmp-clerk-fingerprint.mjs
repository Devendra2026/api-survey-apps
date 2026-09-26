function fingerprint(key) {
  if (!key) return { present: false }
  const k = String(key).trim()
  const kind = k.startsWith("pk_live_")
    ? "pk_live"
    : k.startsWith("pk_test_")
      ? "pk_test"
      : k.startsWith("sk_live_")
        ? "sk_live"
        : k.startsWith("sk_test_")
          ? "sk_test"
          : "other"
  let hostHint = null
  try {
    const part = k.split("_").slice(2).join("_")
    if (part) {
      hostHint = Buffer.from(part, "base64url").toString("utf8").replace(/\0/g, "").slice(0, 80) || null
    }
  } catch {
    hostHint = null
  }
  return { present: true, kind, hostHint }
}

function readEnv(file) {
  try {
    const text = require("fs").readFileSync(file, "utf8")
    const out = {}
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "")
    }
    return out
  } catch {
    return null
  }
}

const roots = [
  ["mobile", "apps/mobile/.env"],
  ["web", "apps/web/.env"],
  ["web.local", "apps/web/.env.local"],
  ["api", "apps/api/.env"],
  ["root", ".env"],
  ["root.local", ".env.local"],
]

const report = {}
for (const [name, file] of roots) {
  const env = readEnv(file)
  if (!env) {
    report[name] = { file, exists: false }
    continue
  }
  report[name] = {
    file,
    exists: true,
    EXPO_PUBLIC_CLERK: fingerprint(env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY),
    NEXT_PUBLIC_CLERK: fingerprint(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    CLERK_SECRET: fingerprint(env.CLERK_SECRET_KEY),
    PORTAL_CLERK_SECRET: fingerprint(env.PORTAL_CLERK_SECRET_KEY),
  }
}
console.log(JSON.stringify(report, null, 2))
