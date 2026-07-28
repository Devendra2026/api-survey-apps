# Task 2 Report: Framework and workspace dependency bumps

## Status

DONE_WITH_CONCERNS

## Commit

- `e34359c` — `chore: bump Next Nest Prisma Clerk and workspace deps`

## Implemented

- Updated `@clerk/nextjs` from 7.5.17 to 7.6.1.
- Updated `@clerk/backend` from 3.11.4 to 3.13.1.
- Updated `@nestjs/swagger` from 11.4.5 to 11.4.6; the remaining requested Nest 11 packages, RxJS, class-validator, and class-transformer were already at the repository's latest policy-approved versions.
- Updated Prisma CLI, Client, and PostgreSQL adapter from 7.8.0 to 7.9.1.
- Kept Next at 16.2.6 and React/React DOM at 19.2.4 because they were already at the repository's policy-approved versions.
- Kept the web and UI React runtime versions aligned.
- Added a workspace override for `@types/react` 19.2.17. Prisma 7.9.1 introduced that type version transitively while the web/UI importers resolved 19.2.15, causing incompatible React `Key` types during the Next build.
- Made the Prisma datasource block conditional so ordinary `prisma generate` works without `DATABASE_URL`; database-connecting commands still receive `DIRECT_URL` or `DATABASE_URL` when supplied.
- Regenerated Prisma Client 7.9.1 successfully.
- Did not change Prisma schema fields or survey, tax, or ETL domain logic.

## Verification

Final verification command:

`pnpm --filter @workspace/database db:generate && pnpm turbo build && pnpm turbo typecheck && pnpm turbo lint && pnpm turbo test`

Results:

- Prisma generate: passed; generated Prisma Client 7.9.1.
- Build: 9/9 tasks passed.
- Typecheck: 15/15 tasks passed.
- Lint: 12/12 tasks passed with 0 errors and 26 existing web warnings.
- Tests: 8/8 tasks passed; API 29 suites/126 tests and ETL core 2 suites/12 tests passed.
- Commit review: `git show --check HEAD` passed with no whitespace errors.
- Working tree after commit contains only the pre-existing untracked `.superpowers/` task artifacts.

## Self-review

- Scope is limited to dependency manifests, lock/workspace resolution, and the minimal Prisma CLI config compatibility fix.
- Version majors remain Next 16, React 19, Nest core 11, Prisma 7, Clerk Next.js 7, and Clerk backend 3.
- Prisma CLI, Client, and adapter versions are aligned at 7.9.1.
- No domain behavior, migrations, or schema fields were modified.
- No correctness or security defects were found in the committed diff.

## Concerns

- pnpm's repository policy held several newly published patches behind preferred versions, including Next 16.2.12, React/React DOM 19.2.8, `@clerk/nextjs` 7.6.2, and `@clerk/backend` 3.13.2. No minimum-release-age bypass was added; the commit uses the latest policy-approved compatible versions.
- Lint remains green but reports 26 pre-existing React hook/compiler warnings in the web workspace; they are outside this dependency-bump task.
