# Task 5 Report: Scope align-wards-with-convex by districtId

- **Status:** COMPLETED
- **Commit:** `42f8b58` feat(etl): scope align-wards-with-convex to districtId
- **Typecheck/Tests:** `apps/api` `pnpm typecheck` PASS; `pnpm test -- etl` PASS (10/10); full `pnpm test:ci` 265 passed, 6 pre-existing failures in `qc.queue.spec.ts` (unrelated to this task).
- **Concerns:** `apps/web` still calls `alignWardsWithConvex` without `districtId`; needs Task 7 UI updates to pass the selected district before end-to-end use.
- **Report Path:** `c:\sdv-books\projects\sdv-edutech-app\api-survey-apps\.superpowers\sdd\task-5-report.md`

## Review fix: reject unknown districtId

- **Status:** COMPLETED
- **Commit:** `7b95ee4` fix(etl): reject unknown districtId in align-wards-with-convex
- **Typecheck:** `apps/api` `pnpm typecheck` PASS
- **Change:** After `assertDistrictId`, `alignWardsWithConvex` now verifies the district exists via `prisma.district.findUnique` and throws `BadRequestException` for unknown IDs (parity with `EtlService.startRefreshPending`).
