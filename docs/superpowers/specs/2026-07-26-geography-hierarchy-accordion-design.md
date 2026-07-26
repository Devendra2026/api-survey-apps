# Geographic Hierarchy Accordion (Master Data)

**Date:** 2026-07-26  
**Status:** Approved for implementation  
**Depends on:** District code assignment (`2026-07-26-district-code-assign-design.md`) — district/ULB codes already on API/tree

## Problem

Admins expect Master Data as a nested accordion (State → District → ULB → ward pills) with codes visible and inline add/edit, matching the Survey App Master Data screenshot. The app currently uses a split tree + details panel on `/configuration/geography`, and Administration nav labels the area “Configuration” while `/master-data` only redirects to the configuration hub.

## Goals

- Replace the geography tree/details layout with a nested accordion that matches the screenshot.
- Show District code, ULB code, ULB type badge (`TP` / `MC`), and ward pills as `W01-Jatav Basti` (display-only).
- Wire Administration → **Master Data** to this page (`/master-data` → `/configuration/geography`).
- Keep existing drawers and geography tree API for CRUD.

## Non-goals

- Changing ward storage format (still canonical unpadded `wardNumber`).
- Lazy-loading wards from a new API (use existing tree payload + client pagination).
- Redesigning Reference Data / Tax Engine / Demand Rules.
- Introducing new fonts outside the existing app design system (prefer current theme tokens; Lucide icons; no emoji icons).

## Layout & navigation

**Route:** `/configuration/geography` (primary UI).

**Hierarchy:**

1. Page search: “Search districts, ULBs, or wards…”
2. State accordion (expand/collapse)
3. District cards: name, code, state name, ULB count, edit
4. Section **ULBS / MUNICIPALITIES** + **+ Add ULB**
5. ULB rows: name, code, type badge, ward count, edit; expand for wards
6. Section **WARDS** + **+ Add ward**; pill grid; client paging (~24/page)

**Nav:**

- Rename Administration child **Configuration** → **Master Data**, href `/configuration/geography` (or `/master-data`).
- `/master-data` redirects to `/configuration/geography`.
- Configuration hub (`/configuration`) remains for Reference / Tax / Settings via workspace tabs or overview.

## Components

| Piece                   | Role                                                      |
| ----------------------- | --------------------------------------------------------- |
| `GeographyAccordion`    | State → District → ULB nest + search                      |
| `WardPillGrid`          | Pills + client pagination                                 |
| `GeoDrawers` (existing) | Create/edit State, District, ULB, Ward                    |
| Remove as primary UX    | `HierarchyExplorer`, `HierarchyDetailsPanel` on this page |

## Interactions

- Independent expand/collapse for State, District, ULB.
- Edit pencil → edit drawer for that entity.
- **+ Add ULB** / **+ Add ward** / Create State (header) → create drawer with parent id.
- Ward pill click → edit ward drawer.
- Search filters nodes and expands ancestors of matches.
- Permissions unchanged: `settings:view` / `settings:manage` (and existing role:assign where used).

## Data & display rules

- Source: `GET /configuration/geography/tree` (includes district `code`, ULB `code`).
- Ward display: `W` + zero-pad `wardNumber` to 2 digits + `-` + name → `W01-Jatav Basti`.
- ULB type: `TOWN_PANCHAYAT` → `TP`, `MUNICIPAL_COUNCIL` → `MC`.
- No schema/API changes required for this UI pass.

## UX notes (fit existing app)

- Use existing theme colors/spacing; Lucide chevrons/pencil; `cursor-pointer` on interactive rows.
- Hover/focus states 150–300ms; keyboard-expandable regions where practical.
- Responsive: stack search + actions on small screens; pills wrap.

## Testing

- Expand State/District/ULB; search finds district/ULB/ward.
- Create/edit district (with code), ULB, ward via drawers.
- Ward pills format + pagination footer.
- Master Data nav lands on accordion geography page.

## Out of scope

- Geo-catalog upload UI.
- Lazy ward API.
- Changing property-ID ward padding rules in validation/import.
