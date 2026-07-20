# Configuration Registry — High-Density UI Refactor Design

**Date:** 2026-07-20  
**Status:** Approved (pending user review of written spec)  
**Module:** Configuration Registry (`/admin/configuration`)  
**Parent spec:** [2026-07-20-configuration-registry-design.md](./2026-07-20-configuration-registry-design.md)  
**Scope this pass:** Shell IA + Geography Tree Table + Reference dense tables (A+B). Tax Engine / Demand Rules / Settings remain in nav with current panels until follow-up (C).

---

## 1. Goals

Replace the horizontal-tab Configuration workspace with an Azure Portal–style high-density registry shell so operators can manage geographic hierarchy and reference catalogs with ERP-grade density, without rebranding away from Enterprise Clarity / Shadcn.

**Success criteria**

- Left sticky Configuration rail replaces horizontal `CONFIG_NAV` tabs
- Geography is a high-density Tree Table (State → District → ULB → Ward) with cascading Add Location drawer
- Reference catalogs are dense CRUD tables, one catalog per left-nav item
- Tax Engine, Demand Rules, Settings stay reachable in the rail; UX for those panels is unchanged this pass
- No new visual brand (no Fira / purple rebrand); extend existing slate/zinc + indigo/blue tokens

---

## 2. Locked decisions

| Decision          | Choice                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Shell             | Approach 1 — sticky left Configuration rail (~240px) + content canvas                                |
| Depth this pass   | A+B — redesign Geography + Reference; Tax/Demand/Settings in nav only                                |
| Geography pattern | A — High-density Tree Table                                                                          |
| Add Location      | A — Cascading context drawer (level first, then parents)                                             |
| Default landing   | Tenants & Wards (`/admin/configuration/geography`), or last-visited if stored                        |
| Responsive rail   | Collapses to icon rail below `lg`                                                                    |
| Visual system     | Enterprise Clarity / Shadcn; slate/zinc surfaces; indigo/blue primary; semantic status badges        |
| Backend           | Reuse existing geo + reference + configuration tree APIs; no schema change required for this UI pass |

---

## 3. Non-goals (this pass)

- Redesigning Tax Engine workspace, Demand Rules, or Settings panels beyond light polish / placement in the rail
- Expression language / formula builder UI
- Full Survey FK cutover or new publish workflow UI
- Replacing app-level sidebar Administration structure
- Changing route base away from `/admin/configuration`

---

## 4. Information architecture

### Shell layout

```text
┌─────────────────────────────────────────────────────────────┐
│ App chrome (existing dashboard shell)                       │
├──────────────┬──────────────────────────────────────────────┤
│ Config rail  │ Content canvas                               │
│ ~240px       │ Toolbar · count chips · primary action       │
│ sticky       │                                              │
│              │ Domain panel (Tree Table / Dense Table / …)  │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### Left rail groups

| Group                    | Items                                                                                                                                                                                       | Notes                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **GEOGRAPHIC HIERARCHY** | Tenants & Wards                                                                                                                                                                             | Deep redesign → Tree Table                          |
| **REFERENCE DATA**       | One item per catalog (Assessment Years, Ownership Types, Property Types, Property Use, Situation, Road Types, Tax Rate Zones, Construction Types, Occupancy Types, Usage Types — as seeded) | Nested list under group; each opens dense table     |
| **TAX & RULES**          | Tax Engine, Demand Rules                                                                                                                                                                    | Unchanged panel components                          |
| **SYSTEM**               | Overview, Settings                                                                                                                                                                          | Overview = light KPI/home; Settings = current panel |

Rail behavior:

- Active item uses indigo/blue accent + subtle background
- Group labels are uppercase muted captions
- Below `lg`: collapse to icons with tooltips; expand via chevron or overlay drawer
- Persist last-visited path in `sessionStorage` key `config.registry.lastPath` (optional nicety; default geography if missing)

### Routes (unchanged base; refine usage)

| Route                                       | Canvas                                                 |
| ------------------------------------------- | ------------------------------------------------------ |
| `/admin/configuration`                      | Overview (light polish)                                |
| `/admin/configuration/geography`            | Geo Tree Table (primary landing)                       |
| `/admin/configuration/reference`            | Redirect or first catalog / catalog index cards (thin) |
| `/admin/configuration/reference/[category]` | Dense reference table for that catalog                 |
| `/admin/configuration/tax-engine`           | Existing Tax workspace                                 |
| `/admin/configuration/demand-rules`         | Existing Demand Rules                                  |
| `/admin/configuration/settings`             | Existing Settings                                      |

Existing redirects (`/configuration/*`, `/master-data`, `/admin/geography`) remain.

### Permissions (unchanged)

| Capability                         | Permission         |
| ---------------------------------- | ------------------ |
| View                               | `settings:view`    |
| Mutate geo / reference / draft tax | `settings:manage`  |
| Publish / rollback tax             | `settings:publish` |

Hide mutate actions when caller lacks `settings:manage`.

---

## 5. Geographic Hierarchy — Tree Table

### 5.1 Data

Consume existing geography tree (`GeographyTreeNode`: `state` → `district` → `ulb` → `ward`) including `status`, `counts`, codes / ward numbers.

### 5.2 Columns

| Column        | Content                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| Name          | Indent by depth · expand chevron · type icon · display name                   |
| Code / Number | State/ULB `code` or Ward `wardNumber`                                         |
| Counts        | Aggregates from `counts` (e.g. districts, ULBs, wards, surveys when present)  |
| Status        | Badge + toggle (`ACTIVE` / `DISABLED`; treat `ARCHIVED` as terminal if shown) |
| Updated       | Prefer entity `updatedAt` when API provides it; otherwise omit or show "—"    |
| Actions       | Edit · Add child · Delete                                                     |

### 5.3 Toolbar

- Search (filter visible tree by name/code)
- Expand all / Collapse all
- Status filter: All | Active | Inactive
- Count chips (totals for states / districts / ULBs / wards in loaded tree)
- Primary CTA: **Add Location**

### 5.4 Interactions

- Row expand/collapse; keyboard: arrows / Enter on chevron
- Status toggle: PATCH existing geo status endpoint; optimistic UI + toast; require `settings:manage`
- **Add Location** / **Add child**: open cascading drawer (see §5.5)
- **Edit**: same drawer, prefilled, level locked
- **Delete**: confirmation dialog; if children exist, block with clear message; otherwise hard delete via existing API

### 5.5 Add Location drawer (cascading)

1. **Level** required first: State | District | ULB | Ward
2. Parent selectors appear for the selected level:
   - District → State
   - ULB → State → District
   - Ward → State → District → ULB
3. Fields: Name; Code (State/ULB); Ward number (Ward); ULB type if applicable
4. Save → invalidate tree query → toast → close

Drawer uses existing Shadcn Sheet/Drawer patterns; focus trap; Escape closes.

---

## 6. Reference Data — Dense table

### 6.1 Navigation

Each seeded `ReferenceCategory` is a left-rail item under REFERENCE DATA. Prefer loading categories from API so new seeded catalogs appear without hardcoding; fallback order can match seed.

Href pattern: keep `/admin/configuration/reference/[category]` where `[category]` is the category **code** (current contract; see `ReferenceCategoryCard` and `useReferenceEntries`). Rail labels use category `name`; matching uses `category.code`.

### 6.2 Columns

| Column   | Source                       |
| -------- | ---------------------------- |
| Position | `sortOrder`                  |
| Label    | `name`                       |
| Value    | `value` or `code`            |
| Status   | Toggle `ACTIVE` ↔ `DISABLED` |
| Actions  | Edit · Delete (archive)      |

### 6.3 Toolbar

- Scoped search on label/value/code
- **Add Option** → side drawer: Label, Value/Code, Description, Status
- Count chip: active / total entries
- Optional multi-select + sticky footer bulk enable/disable when rows selected

### 6.4 Interactions

- Optimistic status toggle + toast
- Edit drawer prefilled
- Delete/archive confirmation
- Gate mutations on `settings:manage`

Evolve existing `ReferenceTable` / `ReferenceDrawer` rather than inventing a parallel stack.

---

## 7. Tax & Rules / System (this pass)

| Item         | Behavior                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Tax Engine   | Mount existing tax workspace in canvas; no IA change inside panel                                   |
| Demand Rules | Mount existing demand rules panel                                                                   |
| Overview     | Compact KPI/cards linking into Tenants & Wards and top catalogs; remove reliance on horizontal tabs |
| Settings     | Existing settings panel                                                                             |

Follow-up “C” may densify Tax Engine / Demand Rules later under the same shell.

---

## 8. Visual & a11y polish

- Surfaces: white / zinc-50 canvas, slate/zinc borders, soft elevation only where needed for drawers/modals
- Primary actions: existing indigo/blue
- Status: green Active · amber Inactive/Disabled · red destructive (delete)
- Motion: 150–200ms transitions; honor `prefers-reduced-motion`
- Focus: visible rings; drawer focus trap; tree `aria-expanded` / `aria-level`; toggles labeled
- Density: compact row height (~36–40px), tighter cell padding than card grids

---

## 9. Component plan

| Component                    | Responsibility                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `ConfigurationShell`         | Layout: sticky left rail + canvas; replaces tab bar in `ConfigurationWorkspace` |
| `ConfigurationSideNav`       | Grouped nav from `CONFIG_NAV` evolution + dynamic reference catalogs            |
| `GeoTreeTable`               | Expandable tree table + toolbar                                                 |
| `AddLocationDrawer`          | Cascading create/edit for geo levels                                            |
| `ReferenceDenseTable`        | Evolve `ReferenceTable` for density + bulk footer                               |
| Existing tax/demand/settings | Unchanged internals; rendered inside shell canvas                               |

Update `CONFIG_NAV` (or successor config) to support groups + nested reference items.

---

## 10. Error / empty states

- Empty tree: illustration-free empty message + **Add Location**
- Search no matches: “No locations match” with clear filters CTA
- Reference empty catalog: **Add Option**
- API errors: inline alert + retry; toast on mutation failure (rollback optimistic state)

---

## 11. Testing checklist (manual)

- [ ] Rail groups render; active state correct across deep links
- [ ] Default / last-visited lands on geography or stored path
- [ ] Icon rail works below `lg`
- [ ] Tree expand/collapse, search, status filter, count chips
- [ ] Add Location cascades parents correctly for each level
- [ ] Edit / delete / status toggle geo with permission gates
- [ ] Each reference catalog opens dense table; CRUD + status toggle
- [ ] Tax Engine / Demand Rules / Settings still reachable and functional
- [ ] Keyboard / focus / reduced-motion smoke check

---

## 12. Out of scope reminders

Do not change Prisma models, Nest modules, or publish/rollback APIs for this UI refactor unless a missing field blocks the Tree Table (e.g. `updatedAt` on tree nodes) — prefer omit column over backend change unless trivial.

---

## 13. Approval record

| Item                          | Status   |
| ----------------------------- | -------- |
| Shell Approach 1              | Approved |
| Scope A+B                     | Approved |
| Tree Table + cascading drawer | Approved |
| Reference dense tables        | Approved |
| Visual polish section         | Approved |
| Written spec user review      | Pending  |
