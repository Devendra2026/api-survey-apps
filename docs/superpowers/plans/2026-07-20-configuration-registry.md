# Configuration Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Masters with a domain-bounded Enterprise Configuration Registry (Reference catalogs, Geography tree, Ward×AY Tax Engine, Demand Rules, audit/publish).

**Architecture:** Shared Configuration Workspace shell; Nest modules `reference-catalogs`, `tax-configs`, `config-audit` + enhanced geo; Prisma catalog/tax tables; feature folder `apps/web/features/configuration`.

**Tech Stack:** Next.js 15+, React 19, TypeScript, Tailwind, Shadcn, TanStack Table/Query, NestJS, Prisma, PostgreSQL, Zod, Lucide.

## Global Constraints

- Extend Enterprise Clarity / existing Shadcn tokens (no Fira rebrand)
- Permissions: `settings:view`, `settings:manage`, `settings:publish`
- Ward-primary tax configs keyed by Ward × Assessment Year
- Parameterized formulas only in v1 (no expression parser)
- Strict TypeScript; no `any`
- Redirect `/master-data` and `/admin/geography` to `/configuration*`
- Do not edit the Cursor plan file

---

## File map

### Create

- `packages/database/prisma/schema.prisma` — add models/enums (modify)
- `packages/database/prisma/seed-reference-catalogs.ts`
- `apps/api/src/common/constants/permissions.ts` — add SETTINGS_PUBLISH
- `packages/database/prisma/seed-catalog.ts` — seed settings:publish
- `apps/api/src/config-audit/*`
- `apps/api/src/reference-catalogs/*`
- `apps/api/src/tax-configs/*`
- `apps/api/src/configuration/*` (geography tree controller)
- `apps/web/features/configuration/**`
- `apps/web/app/(dashboard)/configuration/**`
- Redirect pages for master-data / admin/geography

### Modify

- `apps/api/src/app.module.ts`
- `apps/api/src/states|districts|ulbs|wards` — permissions → settings:*
- `apps/web/lib/navigation.ts`
- `apps/web/hooks/use-api.ts`
- `apps/web/lib/api/types.ts`
- `apps/web/components/admin/roles/matrix-config.ts` (if settings:publish needed)

---

### Task 1: Prisma schema + seed catalogs + settings:publish

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/seed-reference-catalogs.ts`
- Modify: `packages/database/prisma/seed-catalog.ts`
- Modify: `apps/api/src/common/constants/permissions.ts`

- [ ] **Step 1: Add enums and models to schema**

Add after existing geo models:

```prisma
enum ReferenceEntryStatus {
  ACTIVE
  DISABLED
  ARCHIVED
}

enum TaxConfigStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum GeoEntityStatus {
  ACTIVE
  DISABLED
  ARCHIVED
}

model ReferenceCategory {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String
  description String?
  iconKey     String?
  isSystem    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  entries     ReferenceEntry[]
}

model ReferenceEntry {
  id          String               @id @default(cuid())
  categoryId  String
  category    ReferenceCategory    @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  code        String
  name        String
  description String?
  value       String?
  status      ReferenceEntryStatus @default(ACTIVE)
  version     Int                  @default(1)
  sortOrder   Int                  @default(0)
  createdBy   String?
  updatedBy   String?
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  taxConfigsAsAy TaxConfig[] @relation("TaxConfigAssessmentYear")
  rateCellsAsRoad TaxRateCell[] @relation("CellRoadWidth")
  rateCellsAsConstruction TaxRateCell[] @relation("CellConstruction")

  @@unique([categoryId, code])
  @@index([categoryId, status])
}

model TaxConfig {
  id                 String          @id @default(cuid())
  wardId             String
  ward               Ward            @relation(fields: [wardId], references: [id], onDelete: Cascade)
  assessmentYearId   String
  assessmentYear     ReferenceEntry  @relation("TaxConfigAssessmentYear", fields: [assessmentYearId], references: [id])
  status             TaxConfigStatus @default(DRAFT)
  version            Int             @default(1)
  effectiveFrom      DateTime?
  propertyTaxPct     Decimal         @default(10) @db.Decimal(8, 4)
  waterTaxPct        Decimal         @default(0) @db.Decimal(8, 4)
  drainageTaxPct     Decimal         @default(0) @db.Decimal(8, 4)
  penaltyPct         Decimal         @default(0) @db.Decimal(8, 4)
  assessablePct      Decimal         @default(80) @db.Decimal(8, 4)
  publishedAt        DateTime?
  publishedBy        String?
  changeReason       String?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
  cells              TaxRateCell[]
  versions           TaxConfigVersion[]

  @@unique([wardId, assessmentYearId, status, version])
  @@index([wardId, assessmentYearId])
}

model TaxRateCell {
  id                   String         @id @default(cuid())
  taxConfigId          String
  taxConfig            TaxConfig      @relation(fields: [taxConfigId], references: [id], onDelete: Cascade)
  roadWidthEntryId     String
  roadWidthEntry       ReferenceEntry @relation("CellRoadWidth", fields: [roadWidthEntryId], references: [id])
  constructionEntryId  String
  constructionEntry    ReferenceEntry @relation("CellConstruction", fields: [constructionEntryId], references: [id])
  annualRatePerSqFt    Decimal        @default(0) @db.Decimal(14, 4)

  @@unique([taxConfigId, roadWidthEntryId, constructionEntryId])
}

model TaxConfigVersion {
  id          String   @id @default(cuid())
  taxConfigId String
  taxConfig   TaxConfig @relation(fields: [taxConfigId], references: [id], onDelete: Cascade)
  version     Int
  snapshot    Json
  reason      String?
  createdBy   String?
  createdAt   DateTime @default(now())

  @@index([taxConfigId, version])
}

model ConfigAuditLog {
  id         String   @id @default(cuid())
  entityType String
  entityId   String
  action     String
  oldValue   Json?
  newValue   Json?
  reason     String?
  actorId    String?
  createdAt  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([createdAt])
}
```

Also add `status GeoEntityStatus @default(ACTIVE)` and `updatedBy String?` on State, District, Ulb, Ward; add `taxConfigs TaxConfig[]` on Ward.

- [ ] **Step 2: Add SETTINGS_PUBLISH**

```typescript
SETTINGS_PUBLISH: "settings:publish",
```

Seed: `{ name: "settings:publish", description: "Publish and rollback tax configuration" }`

- [ ] **Step 3: Seed reference catalogs from enum values**

Implement `seedReferenceCatalogs(prisma)` upserting categories + entries for OWNERSHIP_TYPE, PROPERTY_USE, PROPERTY_TYPE, ROAD_TYPE, TAX_RATE_ZONE, CONSTRUCTION_TYPE, SITUATION, USAGE_FACTOR, USAGE_TYPE, ASSESSMENT_YEAR, OCCUPANCY_TYPE.

- [ ] **Step 4: Run migrate**

```bash
cd packages/database && npx prisma migrate dev --name configuration_registry
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(db): add configuration registry schema and catalog seed"
```

---

### Task 2: Nest config-audit + reference-catalogs APIs

**Files:**

- Create: `apps/api/src/config-audit/config-audit.service.ts`, `config-audit.module.ts`, `config-audit.controller.ts`
- Create: `apps/api/src/reference-catalogs/*`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: ConfigAuditService.log({ entityType, entityId, action, oldValue, newValue, reason, actorId })**
- [ ] **Step 2: Reference catalogs CRUD**

Endpoints under `/configuration`:

- `GET /configuration/categories`
- `GET /configuration/categories/:code/entries`
- `POST /configuration/entries`
- `PATCH /configuration/entries/:id`
- `POST /configuration/entries/bulk-status`
- `GET /configuration/audit`

Permissions: view=`SETTINGS_VIEW`, mutate=`SETTINGS_MANAGE`.

- [ ] **Step 3: Register modules in AppModule**
- [ ] **Step 4: Commit**

---

### Task 3: Frontend Configuration Workspace + Reference UI (Wave 1)

**Files:**

- Create: `apps/web/features/configuration/**` (shell + reference components)
- Create: `apps/web/app/(dashboard)/configuration/page.tsx` and reference routes
- Create: redirect from `master-data/page.tsx`
- Modify: `apps/web/lib/navigation.ts`, hooks, types

- [ ] **Step 1: Nav — Configuration href `/configuration`, permission `settings:view`; remove Master Data**
- [ ] **Step 2: ConfigurationWorkspace with module tabs**
- [ ] **Step 3: Home cards from categories API**
- [ ] **Step 4: ReferenceTable + ReferenceDrawer (create/edit/clone/archive)**
- [ ] **Step 5: Redirect `/master-data` → `/configuration`**
- [ ] **Step 6: Commit**

---

### Task 4: Geography tree workspace (Wave 2)

**Files:**

- Create: geography tree API + Hierarchy* components
- Create: `/configuration/geography`
- Redirect `/admin/geography`
- Update geo controllers to `SETTINGS_*` permissions
- Wire ConfigAudit on geo mutations

- [ ] **Step 1: `GET /configuration/geography/tree`**
- [ ] **Step 2: HierarchyExplorer + Tree + DetailsPanel + drawers**
- [ ] **Step 3: Redirect admin/geography**
- [ ] **Step 4: Commit**

---

### Task 5: Tax Engine backend + UI (Wave 3)

**Files:**

- Create: `apps/api/src/tax-configs/*`
- Create: TaxWorkspace, WardNavigator, TaxMatrix, TaxRateCell, Formula*, CalculationPreview, DemandNoticePreview

- [ ] **Step 1: TaxConfigsService getOrCreateDraft, patchParams, upsertCells, preview**
- [ ] **Step 2: TaxWorkspace 3-pane UI with autosave**
- [ ] **Step 3: VersionHistoryDrawer (list versions)**
- [ ] **Step 4: Commit**

---

### Task 6: Publish/rollback + Demand Rules + polish (Wave 4)

- [ ] **Step 1: publish / rollback endpoints + PublishDialog / RollbackDialog**
- [ ] **Step 2: Demand Rules page editing TaxConfig % params**
- [ ] **Step 3: Survey dual-map helper `enumCodeToEntryId` in validation package**
- [ ] **Step 4: Add `@tanstack/react-virtual` and virtualize tree if needed**
- [ ] **Step 5: StickyActionBar, AuditTimeline wired everywhere**
- [ ] **Step 6: Commit**

---

## Spec coverage checklist

| Spec item               | Task       |
| ----------------------- | ---------- |
| Catalog tables + seed   | T1         |
| Reference workspace UI  | T3         |
| Geography tree          | T4         |
| Tax matrix + preview    | T5         |
| Publish/rollback/demand | T6         |
| Permissions settings:*  | T1–T4      |
| Redirects               | T3–T4      |
| Formula parameterized   | T5         |
| Audit log               | T2 + T4–T6 |
