# Geography Hierarchy Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the geography tree/details UI with a nested State → District → ULB → ward-pill accordion and wire Administration → Master Data to that page.

**Architecture:** Client-only UI rebuild on existing `useGeographyTree` + `GeoDrawers`. Display helpers for ward/ULB badges. No API/schema changes.

**Tech Stack:** Next.js App Router, React, Tailwind, Lucide, existing `@workspace/ui` components.

## Global Constraints

- Ward display format: `W` + 2-digit pad + `-` + name (e.g. `W01-Jatav Basti`); storage unchanged
- ULB type badge: `TP` / `MC`
- Reuse theme tokens; Lucide only; `cursor-pointer` on interactive elements
- Page: `/configuration/geography`; `/master-data` redirects there

### Task 1: Display helpers

**Files:**

- Create: `apps/web/features/configuration/lib/geo-display.ts`
- Test: `apps/web/features/configuration/lib/geo-display.test.ts` (or colocate if project has no web unit tests — verify via manual / inline asserts in module)

- [ ] Add `formatWardPillLabel(wardNumber, wardName)` → `W01-Jatav Basti`
- [ ] Add `ulbTypeBadge(type)` → `TP` | `MC`
- [ ] Commit with UI if tests not wired for web

### Task 2: WardPillGrid

**Files:**

- Create: `apps/web/features/configuration/components/WardPillGrid.tsx`

- [ ] Render pills; page size 24; footer range + prev/next
- [ ] `onWardClick(ward)` callback

### Task 3: GeographyAccordion

**Files:**

- Create: `apps/web/features/configuration/components/GeographyAccordion.tsx`

- [ ] State → District → ULB nest with expand/collapse
- [ ] Search filter + expand ancestors
- [ ] Edit / Add ULB / Add ward / Add district callbacks
- [ ] Use WardPillGrid

### Task 4: Rewire geography page

**Files:**

- Modify: `apps/web/app/(dashboard)/configuration/geography/page.tsx`

- [ ] Replace HierarchyExplorer/DetailsPanel with GeographyAccordion
- [ ] Keep drawers + CRUD wiring
- [ ] Title/copy: Master Data / Geographic Hierarchy

### Task 5: Master Data nav

**Files:**

- Modify: `apps/web/lib/navigation.ts`
- Modify: `apps/web/app/(dashboard)/master-data/page.tsx`
- Modify: `apps/web/components/layout/app-breadcrumbs.tsx` (label if needed)

- [ ] Rename Configuration → Master Data; href geography
- [ ] Redirect `/master-data` → `/configuration/geography`

### Task 6: Smoke verify

- [ ] Typecheck web (or lint changed files)
- [ ] Manual checklist from spec
