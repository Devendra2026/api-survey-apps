#!/usr/bin/env bash
# Production migrate one-shot: prisma migrate deploy only (idempotent).
# Catalog seed is a one-time manual step — see docs/ops/dokploy-runbook.md.
# Fail closed — never use || true on migrate.
set -Eeuo pipefail

RESOLVE_URL_JS="${RESOLVE_URL_JS:-/app/scripts/docker/resolve-database-url.mjs}"

ts() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Colored logging when stderr is a TTY; plain otherwise.
if [ -t 2 ]; then
  C_OK=$'\033[32m'
  C_ERR=$'\033[31m'
  C_DIM=$'\033[90m'
  C_RST=$'\033[0m'
else
  C_OK=""
  C_ERR=""
  C_DIM=""
  C_RST=""
fi

log() {
  printf '%s %s%s%s\n' "$(ts)" "${C_DIM}" "$*" "${C_RST}"
}

ok() {
  printf '%s %s✓ %s%s\n' "$(ts)" "${C_OK}" "$*" "${C_RST}"
}

fail() {
  printf '%s %s✗ %s%s\n' "$(ts)" "${C_ERR}" "$*" "${C_RST}" >&2
  exit 1
}

# Safe URL parts for logs (never credentials).
db_parts() {
  node --input-type=module <<'EOF'
const url = process.env.DATABASE_URL || "";
try {
  const u = new URL(url);
  const db = (u.pathname || "/").replace(/^\//, "") || "(none)";
  const schema = u.searchParams.get("schema") || "public";
  console.log([u.hostname || "(none)", u.port || "5432", db, schema, u.username || "(none)"].join("\t"));
} catch {
  console.log("(invalid)\t\t\t\t");
  process.exit(1);
}
EOF
}

on_err() {
  code=$?
  cmd="${1:-unknown}"
  printf '\n%s %s✗ migrate failed%s\n' "$(ts)" "${C_ERR}" "${C_RST}" >&2
  printf '  failing command: %s\n' "$cmd" >&2
  printf '  exit code: %s\n' "$code" >&2
  printf '  cwd: %s\n' "$(pwd)" >&2
  if [ -n "${PRISMA_BIN:-}" ]; then
    run_prisma "$PRISMA_BIN" -v 2>&1 | sed 's/^/  prisma: /' >&2 || true
  fi
  exit "$code"
}

trap 'on_err "$BASH_COMMAND"' ERR

apply_database_url() {
  if [ ! -f "$RESOLVE_URL_JS" ]; then
    fail "Missing URL resolver: $RESOLVE_URL_JS (rebuild the api image)"
  fi
  built="$(node "$RESOLVE_URL_JS")" || fail "Failed to resolve DATABASE_URL from POSTGRES_* / override"
  if [ -z "$built" ]; then
    fail "URL resolver returned an empty DATABASE_URL"
  fi
  export DATABASE_URL="$built"
  export DIRECT_URL="$built"
}

debug_startup() {
  [ "${DEBUG_STARTUP:-false}" = "true" ] || return 0
  log "DEBUG_STARTUP=true — filesystem / env keys (no values)"
  log "  /app layout:"
  find /app -maxdepth 3 \( -type d -o -type f -o -type l \) 2>/dev/null | head -n 80 | sed 's/^/    /' || true
  log "  env keys:"
  env | cut -d= -f1 | sort | sed 's/^/    /'
  log "  packages/database:"
  ls -la /app/packages/database 2>/dev/null | sed 's/^/    /' || true
  log "  migrations:"
  ls -la /app/packages/database/prisma/migrations 2>/dev/null | sed 's/^/    /' || true
  if [ -f /app/node_modules/prisma/package.json ]; then
    node -e "const p=require('/app/node_modules/prisma/package.json'); console.log('    prisma', p.version)"
  fi
  if [ -f /app/node_modules/@prisma/client/package.json ]; then
    node -e "const p=require('/app/node_modules/@prisma/client/package.json'); console.log('    @prisma/client', p.version)"
  fi
  if [ -f /app/node_modules/pg/package.json ]; then
    node -e "const p=require('/app/node_modules/pg/package.json'); console.log('    pg', p.version)"
  fi
}

# --- boot ---
log "✓ Loading environment"
apply_database_url
ok "DATABASE_URL resolved (password never logged)"

case "$DATABASE_URL" in
  *REPLACE_ME*)
    fail "DATABASE_URL still contains REPLACE_ME_* — set real Postgres credentials in Dokploy env before deploy."
    ;;
  *@localhost*|*@127.0.0.1*)
    fail "DATABASE_URL must use Compose hostname 'postgres', not localhost/127.0.0.1."
    ;;
esac

IFS=$'\t' read -r DB_HOST DB_PORT DB_NAME DB_SCHEMA DB_USER < <(db_parts) || fail "Could not parse DATABASE_URL"

ok "Node version: $(node -v)"
ok "Working directory will be: /app/packages/database"
ok "DATABASE host: ${DB_HOST}"
ok "DATABASE port: ${DB_PORT}"
ok "DATABASE name: ${DB_NAME}"
ok "DATABASE schema: ${DB_SCHEMA}"
ok "DATABASE user: ${DB_USER}"

cd /app/packages/database
ok "Working directory: $(pwd)"
ok "Schema path: $(pwd)/prisma/schema.prisma"
ok "Migration path: $(pwd)/prisma/migrations"

debug_startup

find_prisma() {
  for candidate in \
    /app/node_modules/.bin/prisma \
    /app/node_modules/.pnpm/node_modules/.bin/prisma \
    /app/packages/database/node_modules/.bin/prisma \
    /app/node_modules/prisma/build/index.js \
    /app/node_modules/@prisma/cli/build/index.js \
    ./node_modules/.bin/prisma
  do
    if [ -x "$candidate" ] || [ -f "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  found="$(find /app/node_modules -path '*/.bin/prisma' \( -type f -o -type l \) -print -quit 2>/dev/null || true)"
  if [ -n "$found" ] && { [ -x "$found" ] || [ -f "$found" ]; }; then
    echo "$found"
    return 0
  fi

  return 1
}

run_prisma() {
  PRISMA_BIN_LOCAL="$1"
  shift
  log "+ prisma $*"
  case "$PRISMA_BIN_LOCAL" in
    *.js)
      node "$PRISMA_BIN_LOCAL" "$@"
      ;;
    *)
      "$PRISMA_BIN_LOCAL" "$@"
      ;;
  esac
}

log "✓ Verifying artifacts"
if [ ! -d /app/node_modules ]; then
  fail "Missing /app/node_modules — image deploy tree is incomplete"
fi

PRISMA_BIN="$(find_prisma)" || fail "Prisma CLI not found under node_modules"
ok "Prisma CLI: $PRISMA_BIN"

if [ ! -f prisma/schema.prisma ]; then
  fail "Missing prisma/schema.prisma"
fi
ok "schema exists"

if [ ! -d prisma/migrations ]; then
  fail "Missing prisma/migrations"
fi
ok "migrations exist"

if [ ! -f prisma.config.ts ]; then
  fail "Missing prisma.config.ts (required for Prisma 7 datasource URL)"
fi

GENERATED=""
if [ -f src/generated/prisma/client.js ]; then
  GENERATED=src/generated/prisma/client.js
elif [ -f src/generated/prisma/client.ts ]; then
  GENERATED=src/generated/prisma/client.ts
else
  fail "Generated Prisma client missing (src/generated/prisma/client.{js,ts})"
fi
ok "generated client exists: $GENERATED"

ENGINE_BIN="$(find /app/node_modules -type f \( -name 'schema-engine*' -o -name 'schema-engine' \) ! -name '*.exe' -print -quit 2>/dev/null || true)"
if [ -z "$ENGINE_BIN" ]; then
  fail "Prisma schema-engine binary not found under /app/node_modules"
fi
ok "Schema engine: $ENGINE_BIN"

run_prisma "$PRISMA_BIN" -v
ok "Prisma CLI available"

# DNS
log "✓ DNS resolution for ${DB_HOST}"
if DB_HOST="$DB_HOST" node --input-type=module <<'EOF'
import dns from "node:dns/promises";
const host = process.env.DB_HOST;
if (!host) {
  console.error("DB_HOST is empty");
  process.exit(1);
}
try {
  const r = await dns.lookup(host);
  console.log(r.address);
  process.exit(0);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
EOF
then
  ok "DNS resolution succeeded"
else
  fail "DNS resolution failed for host ${DB_HOST}"
fi

# TCP + login with exponential backoff
wait_for_postgres() {
  max_attempts="${1:-60}"
  attempt=1
  last_err=""
  sleep_secs=1

  log "✓ Waiting for PostgreSQL (TCP + login)"
  while [ "$attempt" -le "$max_attempts" ]; do
    if out="$(
      node --input-type=module <<'EOF' 2>&1
import net from "node:net";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(2);
}

let parsed;
try {
  parsed = new URL(url);
} catch (e) {
  console.error(`INVALID_URL|${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
}

const host = parsed.hostname;
const port = Number(parsed.port || 5432);

await new Promise((resolve, reject) => {
  const socket = net.connect({ host, port, timeout: 3000 }, () => {
    socket.end();
    resolve();
  });
  socket.on("error", reject);
  socket.on("timeout", () => {
    socket.destroy();
    reject(new Error("TCP timeout"));
  });
});

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 3000 });
try {
  await client.connect();
  await client.query("SELECT 1");
  await client.end();
  process.exit(0);
} catch (err) {
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${code}|${message}`);
  try {
    await client.end();
  } catch {
    // ignore
  }
  process.exit(1);
}
EOF
    )"; then
      ok "TCP connectivity"
      ok "Database login successful"
      return 0
    fi

    last_err="$out"
    case "$out" in
      *28P01*|*"password authentication failed"*|*SASL*)
        fail "Database authentication failed (P1000 / 28P01).

POSTGRES_PASSWORD must match the password stored in the Postgres data volume.
Changing Dokploy env after first volume init does NOT update the DB role password.

Recovery options:
  1) ALTER USER inside the running postgres container to match POSTGRES_PASSWORD, or
  2) Recreate the postgres volume (DESTROYS DATA) and redeploy with matching POSTGRES_PASSWORD.

Detail: ${out}"
        ;;
      *3D000*|*"does not exist"*)
        fail "Database does not exist (check POSTGRES_DB). Detail: $out"
        ;;
      *"Cannot find package"*|*"ERR_MODULE_NOT_FOUND"*)
        fail "Runtime dependency missing for DB wait (pg). Rebuild the api image. Detail: $out"
        ;;
      *INVALID_URL*)
        fail "DATABASE_URL is invalid. Detail: $out"
        ;;
    esac

    log "  PostgreSQL not ready (attempt ${attempt}/${max_attempts}, sleep ${sleep_secs}s): ${out}"
    sleep "$sleep_secs"
    attempt=$((attempt + 1))
    # Exponential backoff capped at 8s
    if [ "$sleep_secs" -lt 8 ]; then
      sleep_secs=$((sleep_secs * 2))
    fi
  done

  fail "PostgreSQL not reachable after ${max_attempts} attempts. Last error: ${last_err}"
}

wait_for_postgres 60

# Known production failure (2026-08-04): migration used wrong table names
# ("Floor"/"Survey") and left _prisma_migrations in failed state → P3009 blocks
# all later deploys. SQL is fixed + idempotent; auto roll back once then retry.
KNOWN_FAILED_FLOOR_REMAP="20260804140100_floor_position_remap_backfill"

migrate_deploy_capture() {
  # Disable ERR trap so a failed deploy can be inspected / retried once.
  trap - ERR
  set +e
  run_prisma "$PRISMA_BIN" migrate deploy 2>&1 | tee "$1"
  local code=${PIPESTATUS[0]}
  set -e
  trap 'on_err "$BASH_COMMAND"' ERR
  return "$code"
}

log "✓ Migration starting (prisma migrate deploy)"
deploy_log="$(mktemp)"
deploy_code=0
migrate_deploy_capture "$deploy_log" || deploy_code=$?

if [ "$deploy_code" -ne 0 ] \
  && grep -q "P3009" "$deploy_log" \
  && grep -q "$KNOWN_FAILED_FLOOR_REMAP" "$deploy_log"; then
  log "✓ Detected failed migration ${KNOWN_FAILED_FLOOR_REMAP} (P3009)"
  log "  Marking rolled-back so fixed SQL can apply (one automatic retry)"
  run_prisma "$PRISMA_BIN" migrate resolve --rolled-back "$KNOWN_FAILED_FLOOR_REMAP"
  log "✓ Migration retrying (prisma migrate deploy)"
  deploy_code=0
  migrate_deploy_capture "$deploy_log" || deploy_code=$?
fi

if [ "$deploy_code" -ne 0 ]; then
  printf '\n%s %s✗ Migration failed%s\n' "$(ts)" "${C_ERR}" "${C_RST}" >&2
  printf '  host=%s db=%s schema=%s user=%s\n' "$DB_HOST" "$DB_NAME" "$DB_SCHEMA" "$DB_USER" >&2
  printf '  cwd=%s\n' "$(pwd)" >&2
  printf '  schema=%s\n' "$(pwd)/prisma/schema.prisma" >&2
  printf '  migrations=%s\n' "$(pwd)/prisma/migrations" >&2
  if grep -q "P3009" "$deploy_log" 2>/dev/null; then
    printf '  hint: prisma migrate resolve --rolled-back <failed_migration_name>\n' >&2
    printf '        then re-run prisma migrate deploy (after fixing SQL if needed)\n' >&2
  fi
  rm -f "$deploy_log"
  exit "$deploy_code"
fi

rm -f "$deploy_log"
ok "Migration completed"

ok "Finished successfully"
