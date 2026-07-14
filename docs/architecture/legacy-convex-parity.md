# Legacy Convex → Prisma Parity Map

Source artifacts:

- Previous app ZIP: `C:\sdv-books\projects\pervious-apps.zip`
- Convex export: `C:\sdv-books\docs\surveys_full_2026-07-10.xlsx`
- Nagar Panchayat report: `E:\Sales\sdv-edutech\sdv-docs\Nagar-Panchayat-Bakewar-survey-data.xlsx`
- Survey Data tax worksheet: `E:\Sales\sdv-edutech\sdv-docs\survey_data (1).xlsx`
- Live reference: `https://survey.sdvedutech.in/dashboard`

## Workflow Axes

Legacy uses two independent axes:

| Axis       | Values                               | Prisma mapping                                                                    |
| ---------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| `status`   | draft, submitted, approved, rejected | `SurveyStatus` DRAFT / SUBMITTED / APPROVED / REJECTED (+ IN_PROGRESS / REOPENED) |
| `qcStatus` | pending, approved, rejected          | New `QcStatus` enum PENDING / APPROVED / REJECTED                                 |

Rules preserved:

1. Submit requires draft (or resubmit after QC reject).
2. QC approve sets status=approved and qcStatus=approved.
3. QC reject resets status toward draft/reopened while qcStatus=rejected.
4. Creators cannot approve/reject their own surveys.
5. JOINT ownership requires ≥1 co-owner; submit requires floors, FRONT photo, GPS.

## Property ID

Format: `{ULB 6}-{Ward 3}-{Parcel 5}-{Unit 3}-{UseLetter}`

Example: `801262-001-00004-001-R`

Use letters: residential=R, commercial=C, open_land=P, religious_property=H, mix_property=M, agricultural_land=A.

Import match key: Property ID first, then Local ID.

## Convex Export Workbook

Sheets (exact names):

1. **Surveys** — 57 columns (Survey ID … Created At)
2. **CoOwners** — Property ID, Survey ID, Owner Index, Name, Father / Husband Name, Mobile, Alt Mobile
3. **Floors** — Property ID, Survey ID, Client Floor ID, Position, Floor, Usage Factor, Usage Type, Construction Type, Occupancy, Area (Sqft)
4. **Photos** — Property ID, Survey ID, Slot, Slot Key, Captured At, Size (KB), Width, Height, Photo URL
5. **Guide** — Topic / Detail help rows

## Enum Label Mapping (import)

| Convex label / slug                                                      | Prisma enum                                |
| ------------------------------------------------------------------------ | ------------------------------------------ |
| individual                                                               | OwnershipType.INDIVIDUAL                   |
| open_land / residential / commercial / mix_property / religious_property | PropertyUse.*                              |
| residential_self / godown / …                                            | PropertyType.*                             |
| interior / main_road / main_market                                       | Situation.*                                |
| rcc / dambar / kaccha                                                    | RoadType.*                                 |
| below_9m / meter_9_to_12 / …                                             | TaxRateZone.*                              |
| ground_floor / first_floor / …                                           | FloorPosition.*                            |
| self_occupied / rented                                                   | UsageType.*                                |
| pakka_rcc_rb / tin_shed / …                                              | ConstructionType.*                         |
| front / side / inside / document                                         | PhotoType FRONT / SIDE / INSIDE / DOCUMENT |
| government_tap / dug_well / borewell / other                             | SourceOfWater.*                            |
| sewer_system / septic_tank / surface_drain / no_toilet / other           | SanitationType.*                           |
| 2025-2026                                                                | AssessmentYear.AY_2025_2026                |

## Navigation / Modules (legacy UX to preserve as behavior)

- Dashboard KPIs, QC operations, org overview, productivity, ward coverage, recent activity
- Field Surveys: Command Center (ward cards) + Survey Registry
- QC Portal: queue, registry, ward detail, remarks, approve/reject
- Reports: Survey Report, Municipality Summary, Surveyor Performance, QC Final, Demand Notice, Nagar Panchayat one-click
- Administration: users, roles, geography/masters

## Schema Gaps To Close

Add to Prisma:

- `QcStatus` + `Survey.qcStatus`
- `Survey.serverVersion`, `completionPct`, `isSlum`, `constructedYear`, `sectorNo`, `electricityConsumerNo`
- GPS: `gpsProvider`, `gpsMockLocation`
- PhotoType: INSIDE, DOCUMENT; optional `clientFloorId` on Floor; `ownerIndex` on CoOwner
- `QcRemark`, import checkpoint fields, saved views
- Indexes for qcStatus + tenant filters

## Report Standards

1. **Convex full export** — multi-sheet round-trip workbook (above).
2. **Nagar Panchayat Bakewar Survey Data** — single sheet `Survey Data`, ~45 columns, government flat layout.
3. **Survey Data tax worksheet** — single sheet with 4 header rows, 82 merges, floor/tax demand matrix.

Do not invent alternate column orders. Match samples exactly.
