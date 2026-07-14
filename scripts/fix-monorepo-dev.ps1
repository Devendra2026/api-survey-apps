# One-shot Turborepo fix for Windows (PowerShell)
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\fix-monorepo-dev.ps1
#
# Rollback:
#   powershell -ExecutionPolicy Bypass -File .\scripts\fix-monorepo-dev.ps1 -Rollback

param(
  [switch]$Rollback
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

if ($Rollback) {
  Write-Step "Rollback: restoring package.json / turbo.json from git"
  git checkout -- package.json turbo.json packages/validation/package.json apps/web/package.json
  Write-Host "Rollback complete." -ForegroundColor Yellow
  exit 0
}

Write-Step "1/5 Ensure Node + pnpm"
node -v
pnpm -v

Write-Step "2/5 Install workspace deps"
pnpm install

Write-Step "3/5 Generate Prisma client + build shared libs"
pnpm db:generate
pnpm run dev:libs

Write-Step "4/5 Verify turbo graph (api/web/worker only)"
pnpm verify:dev

Write-Step "5/5 Done — start the 3 services with:"
Write-Host ""
Write-Host "  pnpm dev" -ForegroundColor Green
Write-Host ""
Write-Host "Ports:" -ForegroundColor Gray
Write-Host "  web     http://localhost:3000"
Write-Host "  api     http://localhost:4000"
Write-Host "  worker  http://localhost:4001"
Write-Host ""
Write-Host "Optional validation watch (separate terminal):" -ForegroundColor Gray
Write-Host "  pnpm dev:validation"
Write-Host ""
Write-Host "Rollback:" -ForegroundColor Gray
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\fix-monorepo-dev.ps1 -Rollback"
