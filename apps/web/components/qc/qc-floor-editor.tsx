"use client"

import { glassInsetClass } from "@/components/surveys/survey-view-field"
import type { QcSurveyFloorEditable, SurveyFloorRow } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

const FLOOR_POSITION_OPTIONS = [
  "BASEMENT",
  "GROUND_FLOOR",
  "FIRST_FLOOR",
  "SECOND_FLOOR",
  "THIRD_FLOOR",
  "FOURTH_FLOOR",
  "FIFTH_FLOOR",
  "SIXTH_FLOOR",
  "OPEN_LAND",
] as const

const USAGE_TYPE_OPTIONS = ["SELF_OCCUPIED", "RENTED"] as const
const USAGE_FACTOR_OPTIONS = [
  "RESIDENTIAL",
  "COMMERCIAL",
  "MIXED",
  "AGRICULTURE",
  "GODOWN",
  "OPEN_LAND",
  "UNDER_CONSTRUCTION",
] as const
const CONSTRUCTION_OPTIONS = [
  "PAKKA_BUILDING_WITH_RCC_ROOF",
  "TIN_SHED",
  "OPEN_LAND",
  "UNDER_CONSTRUCTION",
  "KACCHA_BUILDING",
] as const

type FloorForm = {
  floorPosition: string
  usageType: string
  usageFactor: string
  constructionType: string
  areaSqFt: string
}

const emptyForm = (): FloorForm => ({
  floorPosition: "GROUND_FLOOR",
  usageType: "",
  usageFactor: "RESIDENTIAL",
  constructionType: "PAKKA_BUILDING_WITH_RCC_ROOF",
  areaSqFt: "",
})

function formFromFloor(floor: QcSurveyFloorEditable): FloorForm {
  return {
    floorPosition: floor.floorPosition,
    usageType: floor.usageType ?? "",
    usageFactor: floor.usageFactor ?? "",
    constructionType: floor.constructionType ?? "PAKKA_BUILDING_WITH_RCC_ROOF",
    areaSqFt: floor.areaSqFt != null ? String(floor.areaSqFt) : "",
  }
}

function labelEnum(value: string) {
  return value.replaceAll("_", " ")
}

function segmentKey(usageFactor: string, constructionType: string) {
  return `${usageFactor}::${constructionType}`
}

function floorRowKey(floor: QcSurveyFloorEditable, index: number) {
  return floor.id || `draft-${index}`
}

/** Segments already present on a floor position (usage + construction). */
function usedSegments(floors: QcSurveyFloorEditable[], floorPosition: string, excludeId?: string | null): Set<string> {
  const used = new Set<string>()
  for (const floor of floors) {
    if (excludeId && floor.id === excludeId) continue
    if (floor.floorPosition === floorPosition && floor.usageFactor && floor.constructionType) {
      used.add(segmentKey(floor.usageFactor, floor.constructionType))
    }
  }
  return used
}

/** Prefer next free (usage, construction) pair for adds on this floor. */
function nextFreeSegment(
  floors: QcSurveyFloorEditable[],
  floorPosition: string,
  excludeId?: string | null
): { usageFactor: string; constructionType: string } | null {
  const used = usedSegments(floors, floorPosition, excludeId)
  for (const usageFactor of USAGE_FACTOR_OPTIONS) {
    for (const constructionType of CONSTRUCTION_OPTIONS) {
      if (!used.has(segmentKey(usageFactor, constructionType))) {
        return { usageFactor, constructionType }
      }
    }
  }
  return null
}

function findFloorBySegment(
  floors: QcSurveyFloorEditable[],
  floorPosition: string,
  usageFactor: string,
  constructionType: string
): QcSurveyFloorEditable | undefined {
  return floors.find(
    (f) => f.floorPosition === floorPosition && f.usageFactor === usageFactor && f.constructionType === constructionType
  )
}

function duplicateSegmentMessage(floorPosition: string, usageFactor: string, constructionType: string) {
  return `${labelEnum(floorPosition)} + ${labelEnum(usageFactor)} + ${labelEnum(constructionType)} already exists on this survey. Edit that row instead.`
}

const OPEN_LAND_FORM = (): FloorForm => ({
  floorPosition: "OPEN_LAND",
  usageType: "",
  usageFactor: "OPEN_LAND",
  constructionType: "OPEN_LAND",
  areaSqFt: "",
})

function newDraftFloorId() {
  return `new-${crypto.randomUUID()}`
}

export function QcFloorEditor({
  editMode,
  displayFloors,
  editableFloors,
  onChange,
  builtUpArea,
  openLandPropertyUse = false,
}: {
  editMode: boolean
  displayFloors: SurveyFloorRow[]
  editableFloors: QcSurveyFloorEditable[]
  onChange: (next: QcSurveyFloorEditable[]) => void
  builtUpArea: string
  /** When Property Use is OPEN_LAND, only Open Land floor rows are allowed. */
  openLandPropertyUse?: boolean
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FloorForm>(emptyForm)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const canEdit = editMode

  const floorPositionOptions = useMemo(
    () => (openLandPropertyUse ? (["OPEN_LAND"] as const) : FLOOR_POSITION_OPTIONS),
    [openLandPropertyUse]
  )

  const takenSegments = useMemo(
    () => usedSegments(editableFloors, form.floorPosition, editingId),
    [editableFloors, form.floorPosition, editingId]
  )

  const derivedFloorTotals = useMemo(() => {
    const byPosition = new Map<string, number>()
    for (const floor of editableFloors) {
      if (floor.areaSqFt == null || !Number.isFinite(floor.areaSqFt)) continue
      if (floor.floorPosition === "OPEN_LAND" || floor.usageFactor === "OPEN_LAND") continue
      byPosition.set(floor.floorPosition, (byPosition.get(floor.floorPosition) ?? 0) + floor.areaSqFt)
    }
    return [...byPosition.entries()].map(([floorPosition, totalSqFt]) => ({
      floorPosition,
      totalSqFt,
    }))
  }, [editableFloors])

  const startAdd = () => {
    if (openLandPropertyUse) {
      setEditingId(null)
      setFieldError(null)
      setAdding(true)
      setForm(OPEN_LAND_FORM())
      return
    }
    const floorPosition = "GROUND_FLOOR"
    const free = nextFreeSegment(editableFloors, floorPosition)
    if (!free) {
      toast.error("Every usage/construction combination is already on this floor. Edit an existing row.")
      return
    }
    setEditingId(null)
    setFieldError(null)
    setAdding(true)
    setForm({
      ...emptyForm(),
      floorPosition,
      usageFactor: free.usageFactor,
      constructionType: free.constructionType,
    })
  }

  const startEdit = (floor: QcSurveyFloorEditable) => {
    setAdding(false)
    setFieldError(null)
    setEditingId(floor.id)
    // Leftover Ground Floor (etc.) on open-land plots: open the form pre-set to Open Land.
    if (openLandPropertyUse && (floor.floorPosition !== "OPEN_LAND" || floor.usageFactor !== "OPEN_LAND")) {
      setForm({
        ...formFromFloor(floor),
        floorPosition: "OPEN_LAND",
        usageFactor: "OPEN_LAND",
        constructionType: "OPEN_LAND",
      })
      return
    }
    setForm(formFromFloor(floor))
  }

  const cancel = () => {
    setAdding(false)
    setEditingId(null)
    setFieldError(null)
    setForm(emptyForm())
  }

  const onFloorPositionChange = (floorPosition: string) => {
    const used = usedSegments(editableFloors, floorPosition, editingId)
    const currentKey = segmentKey(form.usageFactor, form.constructionType)
    if (form.usageFactor && form.constructionType && !used.has(currentKey)) {
      setFieldError(null)
      setForm((f) => ({ ...f, floorPosition }))
      return
    }
    const free = nextFreeSegment(editableFloors, floorPosition, editingId)
    if (!free) {
      setFieldError(
        `No free usage/construction left on ${labelEnum(floorPosition)}. Pick another floor or edit an existing row.`
      )
      setForm((f) => ({ ...f, floorPosition }))
      return
    }
    setFieldError(null)
    setForm((f) => ({
      ...f,
      floorPosition,
      usageFactor: free.usageFactor,
      constructionType: free.constructionType,
    }))
  }

  const onUsageFactorChange = (value: string) => {
    const usageFactor = value === "__none" ? "" : value
    if (!usageFactor) {
      setFieldError(null)
      setForm((f) => ({ ...f, usageFactor: "" }))
      return
    }
    const used = usedSegments(editableFloors, form.floorPosition, editingId)
    if (form.constructionType && !used.has(segmentKey(usageFactor, form.constructionType))) {
      setFieldError(null)
      setForm((f) => ({ ...f, usageFactor }))
      return
    }
    for (const constructionType of CONSTRUCTION_OPTIONS) {
      if (!used.has(segmentKey(usageFactor, constructionType))) {
        setFieldError(null)
        setForm((f) => ({ ...f, usageFactor, constructionType }))
        return
      }
    }
    setFieldError(duplicateSegmentMessage(form.floorPosition, usageFactor, form.constructionType || "—"))
    setForm((f) => ({ ...f, usageFactor }))
  }

  const onConstructionTypeChange = (value: string) => {
    const constructionType = value === "__none" ? "" : value
    if (constructionType && form.usageFactor && takenSegments.has(segmentKey(form.usageFactor, constructionType))) {
      setFieldError(duplicateSegmentMessage(form.floorPosition, form.usageFactor, constructionType))
    } else {
      setFieldError(null)
    }
    setForm((f) => ({ ...f, constructionType }))
  }

  const applyFloor = () => {
    setFieldError(null)
    const floorPosition = openLandPropertyUse ? "OPEN_LAND" : form.floorPosition
    const usageFactor = openLandPropertyUse ? "OPEN_LAND" : form.usageFactor || "RESIDENTIAL"
    const constructionType = openLandPropertyUse ? "OPEN_LAND" : form.constructionType || "PAKKA_BUILDING_WITH_RCC_ROOF"
    if (!floorPosition) {
      toast.error("Floor position is required")
      return
    }
    const areaSqFt = form.areaSqFt === "" ? null : Number(form.areaSqFt)
    if (form.areaSqFt !== "" && Number.isNaN(areaSqFt)) {
      toast.error("Area must be a number")
      return
    }

    const existing = findFloorBySegment(editableFloors, floorPosition, usageFactor, constructionType)
    // Edit must not collide with another row; add may merge into the matching segment.
    if (editingId && existing && existing.id !== editingId) {
      const message = duplicateSegmentMessage(floorPosition, usageFactor, constructionType)
      setFieldError(message)
      toast.error(message)
      return
    }

    const nextFloor: QcSurveyFloorEditable = {
      id: editingId ?? existing?.id ?? newDraftFloorId(),
      floorPosition,
      usageType: form.usageType || null,
      usageFactor,
      constructionType,
      areaSqFt,
      position: existing?.position ?? editableFloors.length,
    }

    if (adding) {
      if (existing) {
        onChange(editableFloors.map((f) => (f.id === existing.id ? { ...existing, ...nextFloor, id: existing.id } : f)))
      } else {
        onChange([...editableFloors, nextFloor])
      }
    } else if (editingId) {
      onChange(editableFloors.map((f) => (f.id === editingId ? { ...f, ...nextFloor, id: f.id } : f)))
    }
    cancel()
  }

  const remove = (id: string) => {
    onChange(editableFloors.filter((f) => f.id !== id))
    if (editingId === id) cancel()
  }

  if (!editMode) {
    return (
      <>
        {derivedFloorTotals.length > 0 ? (
          <p className="mb-2 text-xs text-muted-foreground">
            Derived floor totals:{" "}
            {derivedFloorTotals.map((row) => `${labelEnum(row.floorPosition)} ${row.totalSqFt} sq ft`).join(" · ")}
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-xl border border-white/30 dark:border-white/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S. No.</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead>Usage Type</TableHead>
                <TableHead>Usage Factor</TableHead>
                <TableHead>Construction</TableHead>
                <TableHead>Area</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayFloors.length ? (
                displayFloors.map((row) => (
                  <TableRow key={row.sNo}>
                    <TableCell>{row.sNo}</TableCell>
                    <TableCell>{row.floor}</TableCell>
                    <TableCell>{row.usageType}</TableCell>
                    <TableCell>{row.usageFactor}</TableCell>
                    <TableCell>{row.construction}</TableCell>
                    <TableCell>{row.area}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No floor records.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
          TOTAL BUILT-UP AREA: {builtUpArea}
        </p>
      </>
    )
  }

  return (
    <div className="space-y-3">
      {openLandPropertyUse ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Property Use is Open Land — built-up is N/A. Edit leftover floors to Open Land (or delete them). Only Open
          Land floor rows are allowed.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Mixed use: add one row per usage/construction on the same floor (e.g. Ground + Residential + Pakka and Ground
          + Residential + Tin Shed). Floor edits apply to the draft — use page Save to persist.
        </p>
      )}
      {derivedFloorTotals.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Derived floor totals:{" "}
          {derivedFloorTotals.map((row) => `${labelEnum(row.floorPosition)} ${row.totalSqFt} sq ft`).join(" · ")}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-white/30 dark:border-white/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Floor</TableHead>
              <TableHead>Usage Type</TableHead>
              <TableHead>Usage Factor</TableHead>
              <TableHead>Construction</TableHead>
              <TableHead>Area</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editableFloors.length ? (
              editableFloors.map((floor, index) => (
                <TableRow key={floorRowKey(floor, index)}>
                  <TableCell>{labelEnum(floor.floorPosition)}</TableCell>
                  <TableCell>{floor.usageType ? labelEnum(floor.usageType) : "—"}</TableCell>
                  <TableCell>{floor.usageFactor ? labelEnum(floor.usageFactor) : "—"}</TableCell>
                  <TableCell>{floor.constructionType ? labelEnum(floor.constructionType) : "—"}</TableCell>
                  <TableCell>{floor.areaSqFt != null ? String(floor.areaSqFt) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canEdit ? (
                        <Button type="button" size="icon" variant="ghost" onClick={() => startEdit(floor)}>
                          <Pencil className="size-3.5" />
                        </Button>
                      ) : null}
                      <Button type="button" size="icon" variant="ghost" onClick={() => remove(floor.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No floor records.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {canEdit && !adding && !editingId ? (
        <Button type="button" size="sm" variant="outline" onClick={startAdd}>
          <Plus className="size-3.5" />
          {openLandPropertyUse ? "Add open land" : "Add floor"}
        </Button>
      ) : null}
      {canEdit && (adding || editingId) ? (
        <div className={cn(glassInsetClass, "space-y-3 p-4")}>
          <p className="text-sm font-medium">
            {adding
              ? openLandPropertyUse
                ? "Add open land"
                : "Add floor"
              : openLandPropertyUse
                ? "Edit open land"
                : "Edit floor"}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Floor</p>
              <Select value={form.floorPosition} onValueChange={onFloorPositionChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {floorPositionOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {labelEnum(o)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Usage Type</p>
              <Select
                value={form.usageType || "__none"}
                onValueChange={(v) => setForm((f) => ({ ...f, usageType: v === "__none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {USAGE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {labelEnum(o)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Usage Factor</p>
              <Select value={form.usageFactor || "__none"} onValueChange={onUsageFactorChange}>
                <SelectTrigger aria-invalid={Boolean(fieldError) || undefined}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {USAGE_FACTOR_OPTIONS.map((o) => {
                    // Disable usage when every construction pair for it is already taken.
                    const allTaken = CONSTRUCTION_OPTIONS.every((c) => takenSegments.has(segmentKey(o, c)))
                    const isCurrent = form.usageFactor === o
                    const taken = allTaken && !isCurrent
                    return (
                      <SelectItem key={o} value={o} disabled={taken}>
                        {labelEnum(o)}
                        {taken ? " (already on this floor)" : ""}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Construction</p>
              <Select value={form.constructionType || "__none"} onValueChange={onConstructionTypeChange}>
                <SelectTrigger aria-invalid={Boolean(fieldError) || undefined}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {CONSTRUCTION_OPTIONS.map((o) => {
                    const taken =
                      !!form.usageFactor &&
                      takenSegments.has(segmentKey(form.usageFactor, o)) &&
                      form.constructionType !== o
                    return (
                      <SelectItem key={o} value={o} disabled={taken}>
                        {labelEnum(o)}
                        {taken ? " (already on this floor)" : ""}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Area (sq ft)</p>
              <Input
                type="number"
                value={form.areaSqFt}
                onChange={(e) => setForm((f) => ({ ...f, areaSqFt: e.target.value }))}
              />
            </div>
          </div>
          {fieldError ? <p className="text-sm text-destructive">{fieldError}</p> : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={Boolean(fieldError)} onClick={applyFloor}>
              Apply
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">TOTAL BUILT-UP AREA: {builtUpArea}</p>
    </div>
  )
}
