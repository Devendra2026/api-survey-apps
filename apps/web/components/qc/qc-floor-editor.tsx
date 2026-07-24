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
import { useState } from "react"
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
  usageFactor: "",
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

  const startAdd = () => {
    setEditingId(null)
    setAdding(true)
    setForm(emptyForm())
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

  const save = async () => {
    if (!form.floorPosition) {
      toast.error("Floor position is required")
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
      usageFactor: form.usageFactor || null,
      constructionType: form.constructionType || null,
      areaSqFt,
    }
    try {
      if (adding) {
        await floorsApi.create.mutateAsync(body)
        toast.success("Floor created")
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
              <Select value={form.floorPosition} onValueChange={(v) => setForm((f) => ({ ...f, floorPosition: v }))}>
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
                  {USAGE_FACTOR_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {labelEnum(o)}
                    </SelectItem>
                  ))}
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
