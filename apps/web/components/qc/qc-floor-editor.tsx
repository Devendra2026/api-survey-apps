"use client"

import { glassInsetClass } from "@/components/surveys/survey-view-field"
import { useFloorMutations } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
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
  "FIFTH_FLOOR_PLUS",
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
  constructionType: "",
  areaSqFt: "",
})

function formFromFloor(floor: QcSurveyFloorEditable): FloorForm {
  return {
    floorPosition: floor.floorPosition,
    usageType: floor.usageType ?? "",
    usageFactor: floor.usageFactor ?? "",
    constructionType: floor.constructionType ?? "",
    areaSqFt: floor.areaSqFt != null ? String(floor.areaSqFt) : "",
  }
}

function labelEnum(value: string) {
  return value.replaceAll("_", " ")
}

/** Usage factors already present on a floor position (mixed-use rows). */
function usedUsageFactors(floors: QcSurveyFloorEditable[], floorPosition: string): Set<string> {
  const used = new Set<string>()
  for (const floor of floors) {
    if (floor.floorPosition === floorPosition && floor.usageFactor) {
      used.add(floor.usageFactor)
    }
  }
  return used
}

/** Prefer next unused usage for mixed-use adds (Res → Com → …). */
function nextUnusedUsageFactor(floors: QcSurveyFloorEditable[], floorPosition: string): string {
  const used = usedUsageFactors(floors, floorPosition)
  const next = USAGE_FACTOR_OPTIONS.find((o) => !used.has(o))
  return next ?? "RESIDENTIAL"
}

function findFloorByPositionAndUsage(
  floors: QcSurveyFloorEditable[],
  floorPosition: string,
  usageFactor: string
): QcSurveyFloorEditable | undefined {
  return floors.find((f) => f.floorPosition === floorPosition && f.usageFactor === usageFactor)
}

export function QcFloorEditor({
  surveyId,
  editMode,
  displayFloors,
  editableFloors,
  builtUpArea,
}: {
  surveyId: string
  editMode: boolean
  displayFloors: SurveyFloorRow[]
  editableFloors: QcSurveyFloorEditable[]
  builtUpArea: string
}) {
  const floorsApi = useFloorMutations(surveyId)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FloorForm>(emptyForm)

  const busy = floorsApi.create.isPending || floorsApi.update.isPending || floorsApi.remove.isPending

  const derivedFloorTotals = useMemo(() => {
    const byPosition = new Map<string, number>()
    for (const floor of editableFloors) {
      if (floor.areaSqFt == null || !Number.isFinite(floor.areaSqFt)) continue
      byPosition.set(floor.floorPosition, (byPosition.get(floor.floorPosition) ?? 0) + floor.areaSqFt)
    }
    return [...byPosition.entries()].map(([floorPosition, totalSqFt]) => ({
      floorPosition,
      totalSqFt,
    }))
  }, [editableFloors])

  const startAdd = () => {
    setEditingId(null)
    setAdding(true)
    const floorPosition = "GROUND_FLOOR"
    setForm({
      ...emptyForm(),
      floorPosition,
      usageFactor: nextUnusedUsageFactor(editableFloors, floorPosition),
    })
  }

  const startEdit = (floor: QcSurveyFloorEditable) => {
    setAdding(false)
    setEditingId(floor.id)
    setForm(formFromFloor(floor))
  }

  const cancel = () => {
    setAdding(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  const onFloorPositionChange = (floorPosition: string) => {
    setForm((f) => {
      const used = usedUsageFactors(editableFloors, floorPosition)
      // Keep current usage if still free on the new floor; otherwise pick next free.
      const usageFactor =
        f.usageFactor && !used.has(f.usageFactor) ? f.usageFactor : nextUnusedUsageFactor(editableFloors, floorPosition)
      return { ...f, floorPosition, usageFactor }
    })
  }

  const save = async () => {
    if (!form.floorPosition) {
      toast.error("Floor position is required")
      return
    }
    if (!form.usageFactor) {
      toast.error("Usage factor is required")
      return
    }
    const areaSqFt = form.areaSqFt === "" ? null : Number(form.areaSqFt)
    if (form.areaSqFt !== "" && Number.isNaN(areaSqFt)) {
      toast.error("Area must be a number")
      return
    }
    const body = {
      floorPosition: form.floorPosition,
      usageType: form.usageType || null,
      usageFactor: form.usageFactor,
      constructionType: form.constructionType || null,
      areaSqFt,
    }
    try {
      if (adding) {
        // Same floor + usage already exists → update that row (avoids duplicate toast on retry).
        const existing = findFloorByPositionAndUsage(editableFloors, form.floorPosition, form.usageFactor)
        if (existing) {
          await floorsApi.update.mutateAsync({ id: existing.id, body })
          toast.success("Floor usage updated")
        } else {
          await floorsApi.create.mutateAsync(body)
          toast.success("Floor created")
        }
      } else if (editingId) {
        await floorsApi.update.mutateAsync({ id: editingId, body })
        toast.success("Floor updated")
      }
      cancel()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const remove = async (id: string) => {
    try {
      await floorsApi.remove.mutateAsync(id)
      toast.success("Floor deleted")
      if (editingId === id) cancel()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
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
      <p className="text-xs text-muted-foreground">
        Mixed use: add one row per usage on the same floor (e.g. Ground + Residential and Ground + Commercial).
      </p>
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
              editableFloors.map((floor) => (
                <TableRow key={floor.id}>
                  <TableCell>{labelEnum(floor.floorPosition)}</TableCell>
                  <TableCell>{floor.usageType ? labelEnum(floor.usageType) : "—"}</TableCell>
                  <TableCell>{floor.usageFactor ? labelEnum(floor.usageFactor) : "—"}</TableCell>
                  <TableCell>{floor.constructionType ? labelEnum(floor.constructionType) : "—"}</TableCell>
                  <TableCell>{floor.areaSqFt != null ? String(floor.areaSqFt) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => startEdit(floor)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void remove(floor.id)}
                      >
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

      {!adding && !editingId ? (
        <Button type="button" size="sm" variant="outline" onClick={startAdd} disabled={busy}>
          <Plus className="size-3.5" />
          Add floor
        </Button>
      ) : (
        <div className={cn(glassInsetClass, "space-y-3 p-4")}>
          <p className="text-sm font-medium">{adding ? "Add floor" : "Edit floor"}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Floor</p>
              <Select value={form.floorPosition} onValueChange={onFloorPositionChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLOOR_POSITION_OPTIONS.map((o) => (
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
              <Select
                value={form.usageFactor || "__none"}
                onValueChange={(v) => setForm((f) => ({ ...f, usageFactor: v === "__none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {USAGE_FACTOR_OPTIONS.map((o) => {
                    const taken =
                      adding && usedUsageFactors(editableFloors, form.floorPosition).has(o) && form.usageFactor !== o
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
              <Select
                value={form.constructionType || "__none"}
                onValueChange={(v) => setForm((f) => ({ ...f, constructionType: v === "__none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {CONSTRUCTION_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {labelEnum(o)}
                    </SelectItem>
                  ))}
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
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
              Save floor
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">TOTAL BUILT-UP AREA: {builtUpArea}</p>
    </div>
  )
}
