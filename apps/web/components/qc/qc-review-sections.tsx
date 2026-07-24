"use client"

import { QcFloorEditor } from "@/components/qc/qc-floor-editor"
import { QcPhotoEditor } from "@/components/qc/qc-photo-editor"
import { sortByLeadingNumberAsc } from "@/components/qc/qc-sort"
import { GisMap } from "@/components/shared/gis-map"
import {
  glassInsetClass,
  glassPanelClass,
  statusBadgeClass,
  SurveyViewField,
} from "@/components/surveys/survey-view-field"
import { useDistricts, useStates, useUlbs, useUsers, useWards } from "@/hooks/use-api"
import type { QcSurveyDetail, QcSurveyEditable, SurveyAuditHistoryItem, SurveyOwnerRow } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import type { ColumnDef } from "@tanstack/react-table"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { useMemo } from "react"

function GlassSection({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn(glassPanelClass, "overflow-hidden", className)}>
      <div className="border-b border-white/30 px-5 py-4 dark:border-white/10">
        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function GlassTable<T>({ columns, data, empty }: { columns: ColumnDef<T>[]; data: T[]; empty: string }) {
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns unstable function identities
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (!data.length) {
    return (
      <div className={cn(glassInsetClass, "px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400")}>
        {empty}
      </div>
    )
  }

  return (
    <div className={cn(glassInsetClass, "overflow-x-auto")}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="border-white/30 bg-white/30 hover:bg-white/30 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/5"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-10 text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="border-white/20 hover:bg-white/25 dark:border-white/5 dark:hover:bg-white/5"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="py-3 text-sm text-slate-800 dark:text-slate-100">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function EditableField({
  label,
  editMode,
  display,
  children,
}: {
  label: string
  editMode: boolean
  display: React.ReactNode
  children: React.ReactNode
}) {
  if (!editMode) return <SurveyViewField label={label} value={display} />
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
        {label}
      </p>
      {children}
    </div>
  )
}

const PROPERTY_USE_OPTIONS = ["RESIDENTIAL", "COMMERCIAL", "OPEN_LAND", "RELIGIOUS_PROPERTY", "MIX_PROPERTY"]
const PROPERTY_TYPE_OPTIONS = [
  "RESIDENTIAL_SELF",
  "RESIDENTIAL_RENTED",
  "SHOP_BAKERY",
  "BANK_OFFICE",
  "SCHOOL_COLLEGE",
  "MALL_SHOWROOM",
  "PETROL_PUMP",
  "HOTEL_MARRIAGE_RESTAURANT",
  "HOSPITAL_NURSING_PATHOLOGY",
  "GODOWN",
  "CENTRAL_GOVERNMENT",
  "STATE_GOVERNMENT",
  "INDUSTRY",
  "COLD_STORE",
  "OPEN",
  "AGRICULTURE",
  "OPEN_LAND_GODOWN",
  "MANDIR",
  "MASJID",
  "TRUST_DHARAMSHALA",
  "SHAMSHAN_KABRISTAN",
  "GURUDWARA_CHURCH",
  "RESIDENTIAL_AND_COMMERCIAL",
]
const OWNERSHIP_OPTIONS = [
  "INDIVIDUAL",
  "JOINT",
  "LIMITED_COMPANY_FIRM",
  "TRUST_SOCIETY",
  "RELIGIOUS_BODY",
  "STATE_GOVERNMENT_BODY",
  "CENTRAL_GOVERNMENT_BODY",
  "MUNICIPAL_COUNCIL_TOWN_PANCHAYAT",
  "LEASE_PROPERTY",
]
const SITUATION_OPTIONS = ["MAIN_MARKET", "MAIN_ROAD", "INTERIOR"]
const ROAD_OPTIONS = ["RCC", "DAMBAR", "KACCHA"]
const TAX_ZONE_OPTIONS = ["BELOW_9M", "METER_9_TO_12", "METER_12_TO_24", "ABOVE_24M"]
const ASSESSMENT_YEAR_OPTIONS = ["AY_2025_2026", "AY_2026_2027"]
const WATER_OPTIONS = ["YES", "NO", "PARTIAL"]
const SOURCE_WATER_OPTIONS = ["GOVERNMENT_TAP", "DUG_WELL", "BOREWELL", "OTHER"]
const SANITATION_OPTIONS = ["SEWER_SYSTEM", "SEPTIC_TANK", "SURFACE_DRAIN", "NO_TOILET", "OTHER"]

export function QcReviewSections({
  survey,
  audits,
  editMode,
  draft,
  onDraftChange,
}: {
  survey: QcSurveyDetail
  audits: SurveyAuditHistoryItem[]
  editMode: boolean
  draft: QcSurveyEditable
  onDraftChange: (next: QcSurveyEditable) => void
}) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canPickSurveyor = hasPermission("user:view")

  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(draft.stateId || undefined)
  const { data: ulbs } = useUlbs(draft.districtId || undefined)
  const { data: wards } = useWards(draft.ulbId || undefined)
  const { data: users } = useUsers(canPickSurveyor ? { limit: 100, page: 1 } : {})

  const stateItems = useMemo(() => states?.items ?? [], [states?.items])
  const districtItems = useMemo(() => districts?.items ?? [], [districts?.items])
  const ulbItems = useMemo(() => ulbs?.items ?? [], [ulbs?.items])
  const wardItems = useMemo(() => wards?.items ?? [], [wards?.items])
  const userItems = useMemo(() => users?.items ?? [], [users?.items])

  const setField = <K extends keyof QcSurveyEditable>(key: K, value: QcSurveyEditable[K]) => {
    onDraftChange({ ...draft, [key]: value })
  }

  const floorsSorted = useMemo(() => sortByLeadingNumberAsc(survey.floors, (f) => f.sNo), [survey.floors])

  const ownerColumns = useMemo<ColumnDef<SurveyOwnerRow>[]>(
    () => [
      { accessorKey: "propertyId", header: "Property ID" },
      { accessorKey: "name", header: "Name" },
      { accessorKey: "fatherHusband", header: "Father/Husband" },
      { accessorKey: "mobile", header: "Mobile" },
      { accessorKey: "altMobile", header: "Alt Mobile" },
    ],
    []
  )

  const auditColumns = useMemo<ColumnDef<SurveyAuditHistoryItem>[]>(
    () => [
      { accessorKey: "propertyId", header: "Property ID" },
      { accessorKey: "when", header: "When" },
      { accessorKey: "action", header: "Action" },
      { accessorKey: "actor", header: "Actor" },
    ],
    []
  )

  const photoItems =
    survey.photos.length > 0
      ? survey.photos
      : [
          ...(survey.frontPhotoUrl
            ? [
                {
                  id: "front",
                  photoType: "FRONT",
                  label: "Front View",
                  url: survey.frontPhotoUrl,
                  capturedAt: null as string | null,
                  surveyorName: survey.surveyor,
                },
              ]
            : []),
          ...(survey.sidePhotoUrl
            ? [
                {
                  id: "side",
                  photoType: "SIDE",
                  label: "Side View",
                  url: survey.sidePhotoUrl,
                  capturedAt: null as string | null,
                  surveyorName: survey.surveyor,
                },
              ]
            : []),
        ]

  return (
    <div className="flex flex-col gap-6">
      <GlassSection
        title="Property Identification"
        subtitle="Geography, parcel, and surveyor — all editable during QC."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <EditableField label="State" editMode={editMode} display={survey.stateName ?? "—"}>
            <Select
              value={draft.stateId || ""}
              onValueChange={(stateId) =>
                onDraftChange({
                  ...draft,
                  stateId,
                  districtId: "",
                  ulbId: "",
                  wardId: "",
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {stateItems.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="District" editMode={editMode} display={survey.district}>
            <Select
              value={draft.districtId || ""}
              onValueChange={(districtId) => onDraftChange({ ...draft, districtId, ulbId: "", wardId: "" })}
              disabled={!draft.stateId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select district" />
              </SelectTrigger>
              <SelectContent>
                {districtItems.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="ULB / Local Body" editMode={editMode} display={survey.ulbName}>
            <Select
              value={draft.ulbId || ""}
              onValueChange={(ulbId) => onDraftChange({ ...draft, ulbId, wardId: "" })}
              disabled={!draft.districtId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select ULB" />
              </SelectTrigger>
              <SelectContent>
                {ulbItems.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="Ward Number" editMode={editMode} display={survey.wardNo}>
            <Select
              value={draft.wardId || ""}
              onValueChange={(wardId) => setField("wardId", wardId)}
              disabled={!draft.ulbId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select ward" />
              </SelectTrigger>
              <SelectContent>
                {wardItems.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.wardNumber} — {w.wardName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="Sector / Zone" editMode={editMode} display={survey.sectorZone}>
            <Input value={draft.sectorNo ?? ""} onChange={(e) => setField("sectorNo", e.target.value)} />
          </EditableField>
          <EditableField label="Parcel Number" editMode={editMode} display={survey.parcelNo}>
            <Input value={draft.parcelNumber ?? ""} onChange={(e) => setField("parcelNumber", e.target.value)} />
          </EditableField>
          <EditableField label="Unit / Sub-No" editMode={editMode} display={survey.unitSubNo}>
            <Input value={draft.unitSubNo ?? ""} onChange={(e) => setField("unitSubNo", e.target.value)} />
          </EditableField>
          <EditableField label="Property ID (Old)" editMode={editMode} display={survey.propertyIdOld}>
            <Input value={draft.propertyIdOld ?? ""} onChange={(e) => setField("propertyIdOld", e.target.value)} />
          </EditableField>
          <EditableField label="Constructed Year" editMode={editMode} display={survey.constructedYear}>
            <Input
              type="number"
              value={draft.constructedYear ?? ""}
              onChange={(e) => setField("constructedYear", e.target.value === "" ? null : Number(e.target.value))}
            />
          </EditableField>
          <SurveyViewField
            label="Survey Status"
            value={<Badge className={cn("rounded-full", statusBadgeClass(survey.status))}>{survey.status}</Badge>}
          />
          <EditableField label="Surveyor" editMode={editMode} display={survey.surveyor}>
            {canPickSurveyor ? (
              <Select
                value={draft.assignedToId ?? ""}
                onValueChange={(assignedToId) => setField("assignedToId", assignedToId || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select surveyor" />
                </SelectTrigger>
                <SelectContent>
                  {userItems.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={survey.surveyor} disabled />
            )}
          </EditableField>
          <EditableField label="Slum Area" editMode={editMode} display={survey.slumArea}>
            <Select value={draft.isSlum ? "yes" : "no"} onValueChange={(v) => setField("isSlum", v === "yes")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </EditableField>
        </div>
      </GlassSection>

      <GlassSection title="Owner & Household" subtitle="Respondent and co-owners from the mobile survey.">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <EditableField label="Respondent Name" editMode={editMode} display={survey.respondentName}>
            <Input value={draft.respondentName ?? ""} onChange={(e) => setField("respondentName", e.target.value)} />
          </EditableField>
          <EditableField label="Mobile Number" editMode={editMode} display={survey.mobileNumber}>
            <Input value={draft.mobileNumber ?? ""} onChange={(e) => setField("mobileNumber", e.target.value)} />
          </EditableField>
          <EditableField label="Family Size" editMode={editMode} display={survey.familySize ?? "—"}>
            <Input
              type="number"
              value={draft.familySize ?? ""}
              onChange={(e) => setField("familySize", e.target.value === "" ? null : Number(e.target.value))}
            />
          </EditableField>
          <EditableField label="Relationship" editMode={editMode} display={survey.relationshipWithOwner}>
            <Input
              value={draft.relationshipWithOwner ?? ""}
              onChange={(e) => setField("relationshipWithOwner", e.target.value)}
            />
          </EditableField>
          <EditableField label="Alt Mobile" editMode={editMode} display={survey.altMobile}>
            <Input value={draft.alternateMobile ?? ""} onChange={(e) => setField("alternateMobile", e.target.value)} />
          </EditableField>
          <SurveyViewField label="Father / Husband Name" value={survey.fatherHusbandName} />
        </div>
        <GlassTable columns={ownerColumns} data={survey.owners} empty="No co-owner records." />
      </GlassSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassSection title="Address" subtitle="Postal and locality details.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EditableField label="House / Door No" editMode={editMode} display={survey.houseDoorNo}>
              <Input value={draft.houseDoorNo ?? ""} onChange={(e) => setField("houseDoorNo", e.target.value)} />
            </EditableField>
            <EditableField label="Colony / Society" editMode={editMode} display={survey.colonySociety}>
              <Input value={draft.colony ?? ""} onChange={(e) => setField("colony", e.target.value)} />
            </EditableField>
            <EditableField label="Locality / Landmark" editMode={editMode} display={survey.localityLandmark}>
              <Input value={draft.locality ?? ""} onChange={(e) => setField("locality", e.target.value)} />
            </EditableField>
            <EditableField label="City" editMode={editMode} display={survey.city}>
              <Input value={draft.city ?? ""} onChange={(e) => setField("city", e.target.value)} />
            </EditableField>
            <EditableField label="PIN Code" editMode={editMode} display={survey.pinCode}>
              <Input value={draft.pinCode ?? ""} onChange={(e) => setField("pinCode", e.target.value)} />
            </EditableField>
          </div>
        </GlassSection>

        <GlassSection title="GIS Mapping" subtitle="Captured field location coordinates.">
          <GisMap latitude={survey.latitude} longitude={survey.longitude} coordinates={survey.coordinates} />
        </GlassSection>
      </div>

      <GlassSection title="Taxation & Floor Details" subtitle="Assessment classification and floor breakdown.">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <EditableField label="Assessment Year" editMode={editMode} display={survey.assessmentYear}>
            <Select value={draft.assessmentYear || ""} onValueChange={(v) => setField("assessmentYear", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {ASSESSMENT_YEAR_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="Ownership Type" editMode={editMode} display={survey.ownershipType}>
            <Select value={draft.ownershipType ?? ""} onValueChange={(v) => setField("ownershipType", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {OWNERSHIP_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="Property Use" editMode={editMode} display={survey.propertyUse}>
            <Select value={draft.propertyUse ?? ""} onValueChange={(v) => setField("propertyUse", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_USE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="Property Type" editMode={editMode} display={survey.propertyType}>
            <Select value={draft.propertyType ?? ""} onValueChange={(v) => setField("propertyType", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="Situation" editMode={editMode} display={survey.situation}>
            <Select value={draft.situation ?? ""} onValueChange={(v) => setField("situation", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {SITUATION_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="Road Type" editMode={editMode} display={survey.roadType}>
            <Select value={draft.roadType ?? ""} onValueChange={(v) => setField("roadType", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {ROAD_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="Tax Rate Zone" editMode={editMode} display={survey.taxRateZone}>
            <Select value={draft.taxRateZone ?? ""} onValueChange={(v) => setField("taxRateZone", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {TAX_ZONE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <EditableField label="Plot Area (sq ft)" editMode={editMode} display={survey.plotArea}>
            <Input
              type="number"
              value={draft.plotAreaSqFt ?? ""}
              onChange={(e) => setField("plotAreaSqFt", e.target.value === "" ? null : Number(e.target.value))}
            />
          </EditableField>
          <EditableField label="Plinth Area (sq ft)" editMode={editMode} display={survey.plinthArea}>
            <Input
              type="number"
              value={draft.plinthAreaSqFt ?? ""}
              onChange={(e) => setField("plinthAreaSqFt", e.target.value === "" ? null : Number(e.target.value))}
            />
          </EditableField>
          <div className={cn(glassInsetClass, "p-3")}>
            <SurveyViewField label="Built-Up Area" value={survey.builtUpArea} />
          </div>
        </div>

        <QcFloorEditor
          surveyId={survey.id}
          editMode={editMode}
          displayFloors={floorsSorted}
          editableFloors={survey.editable.floors}
          builtUpArea={survey.builtUpArea}
        />
      </GlassSection>

      <GlassSection title="Municipal Services & Photo Documentation" subtitle="Utilities and field photo evidence.">
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <EditableField label="Water Connection" editMode={editMode} display={survey.waterConnection}>
            <Select value={draft.waterConnection ?? ""} onValueChange={(v) => setField("waterConnection", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {WATER_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="Source" editMode={editMode} display={survey.sourceOfWater}>
            <Select value={draft.sourceOfWater ?? ""} onValueChange={(v) => setField("sourceOfWater", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_WATER_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="Sanitation Type" editMode={editMode} display={survey.sanitationType}>
            <Select value={draft.sanitationType ?? ""} onValueChange={(v) => setField("sanitationType", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {SANITATION_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="Door-to-Door Collection" editMode={editMode} display={survey.doorToDoorCollection}>
            <Select
              value={draft.solidWasteCollection == null ? "" : draft.solidWasteCollection ? "yes" : "no"}
              onValueChange={(v) => setField("solidWasteCollection", v === "yes")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </EditableField>
          <EditableField label="Electricity Consumer No" editMode={editMode} display={survey.electricityConsumerNo}>
            <Input
              value={draft.electricityConsumerNo ?? ""}
              onChange={(e) => setField("electricityConsumerNo", e.target.value)}
            />
          </EditableField>
        </div>

        <QcPhotoEditor
          surveyId={survey.id}
          photos={photoItems}
          surveyorFallback={survey.surveyor}
          editMode={editMode}
        />
      </GlassSection>

      <GlassSection title="Audit History" subtitle="Real-time QC and survey workflow timeline.">
        <GlassTable columns={auditColumns} data={audits} empty="No audit history yet." />
      </GlassSection>
    </div>
  )
}
