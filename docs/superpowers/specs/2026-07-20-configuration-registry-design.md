# Configuration Registry — Enterprise Design Spec

**Date:** 2026-07-20  
**Status:** Approved  
**Module:** Configuration Registry (replaces Masters / Master Data)  
**Approach:** Domain-bounded Configuration Registry (Approach 2)

---

## 1. Goals

Redesign Masters into an Enterprise Configuration Registry — the backbone of the Property Tax platform. Every Survey, Assessment, Demand Notice, Tax Calculation, and Geographic Assignment consumes configuration from this module.

Success means the product behaves like a premium Government ERP (SAP Master Data / Oracle Fusion Setup / Dynamics / Salesforce Metadata / Azure Portal), not a flat CRUD page.

---

## 2. Locked product decisions

| Decision       | Choice                                                                  |
| -------------- | ----------------------------------------------------------------------- |
| Architecture   | Domain-bounded registry with shared workspace shell                     |
| Delivery       | Full design; phased waves W1→W4                                         |
| Reference data | Promote Prisma enums → PostgreSQL catalog tables (seed from enums)      |
| Formulas       | Parameterized ALV/demand engine in v1; expression language later        |
| Tax grain      | Ward-primary (matrix + publish per ward)                                |
| AY binding     | Tax configs keyed by **Ward × Assessment Year**                         |
| Visual system  | Extend Enterprise Clarity / Shadcn tokens; Lucide only; no Fira rebrand |
| Permissions    | `settings:view`, `settings:manage`, `settings:publish` (new)            |

---

## 3. Non-goals

- Free-form expression formula language in v1
- ULB inheritance of tax rates (ward-primary only)
- Full Survey FK cutover in Wave 1 (starts Wave 4 dual-map)
- Redesigning Surveys / QC / Import beyond consuming new config APIs
- Changing the plan file itself after approval

---

## 4. Information architecture

### Routes

| Route                                 | Purpose                                |
| ------------------------------------- | -------------------------------------- |
| `/configuration`                      | Workspace home — category cards + KPIs |
| `/configuration/reference`            | Reference category grid                |
| `/configuration/reference/[category]` | Enterprise table for one catalog       |
| `/configuration/geography`            | Hierarchy Explorer + details panel     |
| `/configuration/tax-engine`           | Tax Workspace (Ward × AY)              |
| `/configuration/demand-rules`         | Penalty / demand notice parameters     |
| `/configuration/settings`             | Registry defaults, permission notes    |

Redirects: `/master-data` → `/configuration`, `/admin/geography` → `/configuration/geography`.

### Top module navigation

Reference Data · Geographic Hierarchy · Tax Engine · Demand Rules · Settings

### Permissions

| Capability                         | Permission         |
| ---------------------------------- | ------------------ |
| View registry                      | `settings:view`    |
| Mutate reference / geo / draft tax | `settings:manage`  |
| Publish / rollback tax             | `settings:publish` |
| View config audit                  | `settings:view`    |

Retire UI gate on `role:assign` for this module.

---

## 5. Data model

### Reference catalogs

```text
ReferenceCategory (code, name, description, iconKey, isSystem)
ReferenceEntry (
  categoryId, code, name, description, value?,
  status: ACTIVE|DISABLED|ARCHIVED,
  version, sortOrder,
  createdBy, updatedBy, createdAt, updatedAt
)
```

Seed from: AssessmentYear, OwnershipType, PropertyUse, PropertyType, RoadType, TaxRateZone (Road Width), ConstructionType, Situation, UsageFactor, UsageType; add OccupancyType.

**Survey migration:**

1. W1: catalogs + API/UI; Survey still uses Prisma enums
2. W2–W3: dual-write / map enum ↔ `ReferenceEntry.code`
3. W4+: Survey/Floor FKs or stable codes; drop unused enums when safe

### Geography

Keep `State → District → Ulb → Ward`. Add `status`, `updatedBy` where missing; wire mutations to `ConfigAuditLog`.

### Tax Rate Engine (Ward × Assessment Year)

```text
TaxConfig (
  wardId, assessmentYearId,
  status: DRAFT|PUBLISHED|ARCHIVED,
  version, effectiveFrom?,
  propertyTaxPct, waterTaxPct, drainageTaxPct, penaltyPct,
  assessablePct (default 80),
  publishedAt, publishedBy, changeReason?
)
TaxRateCell (taxConfigId, roadWidthEntryId, constructionEntryId, annualRatePerSqFt)
TaxConfigVersion (immutable snapshot JSON)
ConfigAuditLog (entityType, entityId, action, oldValue, newValue, reason, actorId, at)
```

### Demand / penalty rules

v1: parameters live on `TaxConfig`; Demand Rules page edits those params + notice flags.

---

## 6. Tax Engine

**Parameterized formulas (v1):**

- Gross ALV = Area × Annual Rate
- Assessable ALV = Gross × assessablePct
- Property Tax = Assessable × propertyTaxPct
- Water Tax = Assessable × waterTaxPct
- Drainage Tax = Assessable × drainageTaxPct
- Penalty = Property Tax × penaltyPct
- Demand = Property + Water + Drainage + Penalty

`FormulaBuilder` = read-only formula inspector + parameter editor (no expression parser).

**Publishing:** Draft autosave → Publish (immutable version) → Rollback restores snapshot into new Draft.

---

## 7. Component inventory

ConfigurationWorkspace, ReferenceCategoryCard, ReferenceTable, ReferenceDrawer, HierarchyExplorer, HierarchyTree, HierarchyDetailsPanel, StateDrawer, DistrictDrawer, ULBDrawer, WardDrawer, TaxWorkspace, WardNavigator, TaxMatrix, TaxRateCell, FormulaPreview, CalculationPreview, DemandNoticePreview, FormulaBuilder, VersionHistoryDrawer, AuditTimeline, PublishDialog, RollbackDialog, ConfigurationStats, ConfigurationToolbar, StickyActionBar, SearchToolbar.

---

## 8. Folder structure

```text
apps/web/app/(dashboard)/configuration/...
apps/web/features/configuration/{components,hooks,lib}/
apps/api/src/{configuration,reference-catalogs,tax-configs,config-audit}/
```

---

## 9. API surface

| Area     | Endpoints                                                                                  |
| -------- | ------------------------------------------------------------------------------------------ |
| Catalogs | `GET/POST /configuration/categories`, `GET/POST/PATCH /configuration/entries`, bulk status |
| Geo      | Existing CRUD + `GET /configuration/geography/tree`                                        |
| Tax      | `GET/PATCH /tax-configs`, `PUT .../cells`, `POST .../publish                               | rollback | preview` |
| Audit    | `GET /configuration/audit`                                                                 |

---

## 10. Delivery waves

| Wave | Scope                                                                            |
| ---- | -------------------------------------------------------------------------------- |
| W1   | Catalog schema + seed; workspace shell; Reference UI; nav redirects; permissions |
| W2   | Geography tree + drawers; geo audit; retire `/admin/geography`                   |
| W3   | TaxConfig matrix; preview; draft autosave; version history                       |
| W4   | Publish/rollback; Demand Rules; survey code mapping; virtualization              |

---

## 11. UX / quality

- Enterprise Clarity theme; data-dense tables; sticky headers/sidebars/footers
- TanStack Query + optimistic updates; virtualize large trees/matrices
- Keyboard navigation, ARIA, focus management, dark mode, responsive stacking
- Strict TypeScript; no `any`; SOLID Nest services; reusable feature components

---

## 12. Self-review

- No TBD placeholders remaining for v1 scope
- Survey FK cutover explicitly deferred to W4+
- Expression language explicitly future-only
- Scope fits four implementable waves
