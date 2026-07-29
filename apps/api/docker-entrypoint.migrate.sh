#!/usr/bin/env bash
# Production migrate one-shot: prisma migrate deploy + catalog seed.
# Fail closed — never use || true on migrate/seed.
set -Eeuo pipefail

log() {
  printf '%s\n' "$*"
}

ok() {
  printf '✓ %s\n' "$*"
}

fail() {
  printf '✗ %s\n' "$*" >&2
  exit 1
}

# Print DATABASE_URL host only (never credentials).
db_host_only() {
  url="${1:-}"
  # Strip scheme://userinfo@
  rest="${url#*://}"
  case "$rest" in
    *@*)
      rest="${rest#*@}"
      ;;
  esac
  hostport="${rest%%/*}"
  host="${hostport%%:*}"
  printf '%s' "$host"
}

on_err() {
  code=$?
  cmd="${1:-unknown}"
  printf '\n✗ migrate failed\n' >&2
  printf '  failing command: %s\n' "$cmd" >&2
  printf '  exit code: %s\n' "$code" >&2
  printf '  cwd: %s\n' "$(pwd)" >&2
  if [ -n "${PRISMA_BIN:-}" ]; then
    run_prisma "$PRISMA_BIN" -v 2>&1 | sed 's/^/  prisma: /' >&2 || true
  fi
  exit "$code"
}

trap 'on_err "$BASH_COMMAND"' ERR

# Prefer DIRECT_URL over pooled DATABASE_URL for migrations when both are set.
log "✓ Loading environment"
if [ -n "${DIRECT_URL:-}" ]; then
  export DATABASE_URL="$DIRECT_URL"
  log "  using DIRECT_URL for migrate/seed connection"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL or DIRECT_URL is required to run migrations"
fi

case "$DATABASE_URL" in
  *REPLACE_ME*)
    fail "DATABASE_URL still contains REPLACE_ME_* — set the real Postgres password in Dokploy env before deploy."
    ;;
  *@localhost*|*@127.0.0.1*)
    fail "DATABASE_URL must use Compose hostname 'postgres', not localhost/127.0.0.1 (example: postgresql://postgres:PASS@postgres:5432/survey?schema=public)."
    ;;
esac

DB_HOST="$(db_host_only "$DATABASE_URL")"
ok "Environment validated (database host: ${DB_HOST})"

cd /app/packages/database
ok "Working directory: $(pwd)"

# Runner image has no pnpm; locate the Prisma CLI from the deploy tree
# (pnpm deploy often nests bins under node_modules/.pnpm/...).
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

find_tsx() {
  for candidate in \
    /app/node_modules/.bin/tsx \
    /app/node_modules/tsx/dist/cli.mjs \
    /app/packages/database/node_modules/.bin/tsx \
    /app/packages/database/node_modules/tsx/dist/cli.mjs
  do
    if [ -x "$candidate" ] || [ -f "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  found="$(find /app/node_modules -path '*/tsx/dist/cli.mjs' -type f -print -quit 2>/dev/null || true)"
  if [ -n "$found" ]; then
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

run_seed() {
  TSX_BIN_LOCAL="$1"
  log "+ tsx prisma/seed.ts"
  case "$TSX_BIN_LOCAL" in
    *.mjs)
      node "$TSX_BIN_LOCAL" prisma/seed.ts
      ;;
    *)
      "$TSX_BIN_LOCAL" prisma/seed.ts
      ;;
  esac
}

log "✓ Verifying node_modules / Prisma / generated client / migrations"
if [ ! -d /app/node_modules ]; then
  fail "Missing /app/node_modules — image deploy tree is incomplete"
fi

PRISMA_BIN="$(find_prisma)" || fail "Prisma CLI not found under node_modules"
ok "Prisma CLI: $PRISMA_BIN"

if [ ! -f prisma/schema.prisma ]; then
  fail "Missing prisma/schema.prisma"
fi
if [ ! -d prisma/migrations ]; then
  fail "Missing prisma/migrations"
fi
if [ ! -f prisma.config.ts ]; then
  fail "Missing prisma.config.ts (required for Prisma 7 datasource URL)"
fi
if [ ! -f prisma/seed.ts ]; then
  fail "Missing prisma/seed.ts"
fi

GENERATED=""
if [ -f src/generated/prisma/client.js ]; then
  GENERATED=src/generated/prisma/client.js
elif [ -f src/generated/prisma/client.ts ]; then
  GENERATED=src/generated/prisma/client.ts
else
  fail "Generated Prisma client missing (src/generated/prisma/client.{js,ts})"
fi
ok "Generated client: $GENERATED"

ENGINE_BIN="$(find /app/node_modules -type f \( -name 'schema-engine*' -o -name 'schema-engine' \) ! -name '*.exe' -print -quit 2>/dev/null || true)"
if [ -z "$ENGINE_BIN" ]; then
  fail "Prisma schema-engine binary not found under /app/node_modules"
fi
ok "Schema engine: $ENGINE_BIN"

run_prisma "$PRISMA_BIN" -v
ok "Prisma generate tooling present"

# Wait until Postgres accepts connections (healthy ≠ ready for our credentials).
# Use `if` so expected connection failures do not trip `set -e` / ERR trap.
wait_for_postgres() {
  max_attempts="${1:-60}"
  sleep_secs="${2:-2}"
  attempt=1
  last_err=""

  log "✓ Waiting for PostgreSQL"
  while [ "$attempt" -le "$max_attempts" ]; do
    if out="$(
      node --input-type=module <<'EOF' 2>&1
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(2);
}

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
      ok "Database reachable"
      return 0
    fi

    last_err="$out"
    case "$out" in
      *28P01*|*"password authentication failed"*|*SASL*)
        fail "Database authentication failed (check DATABASE_URL password matches POSTGRES_PASSWORD). Detail: $out"
        ;;
      *3D000*|*"does not exist"*)
        fail "Database does not exist (check POSTGRES_DB / DATABASE_URL path). Detail: $out"
        ;;
      *"Cannot find package"*|*"ERR_MODULE_NOT_FOUND"*)
        fail "Runtime dependency missing for DB wait (pg). Rebuild the api image. Detail: $out"
        ;;
    esac

    log "  PostgreSQL not ready (attempt ${attempt}/${max_attempts}): ${out}"
    attempt=$((attempt + 1))
    sleep "$sleep_secs"
  done

  fail "PostgreSQL not reachable after ${max_attempts} attempts. Last error: ${last_err}"
}

wait_for_postgres 60 2

# Idempotent: applies pending migrations or exits 0 with "No pending migrations to apply."
# This one-shot job is the only production migrate path (api/worker do not run migrate).
log "✓ Prisma migrate deploy"
run_prisma "$PRISMA_BIN" migrate deploy
ok "Prisma migrate deploy"

# Catalog seed (roles, permissions, reference catalogs, sample geo) — idempotent upserts.
# Demo users/surveys stay off in production unless SEED_DEMO=true.
if [ "${SKIP_DB_SEED:-false}" = "true" ]; then
  ok "Skipping catalog seed (SKIP_DB_SEED=true)"
  ok "Finished successfully"
  exit 0
fi

export SEED_DEMO="${SEED_DEMO:-false}"
log "✓ Seed execution (SEED_DEMO=$SEED_DEMO)"

TSX_BIN="$(find_tsx)" || fail "tsx not found under node_modules — cannot run catalog seed. Rebuild the api image."

run_seed "$TSX_BIN"
ok "Seed execution"

ok "Finished successfully"
