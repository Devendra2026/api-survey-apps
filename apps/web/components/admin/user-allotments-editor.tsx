"use client"

import { FormField } from "@/components/forms/form-field"
import { useDistricts, useStates, useUlbs, useWards } from "@/hooks/use-api"
import type { GeoWard } from "@/lib/api/types"
import { formatWardOptionLabel } from "@/lib/format-ward-label"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"
import { Loader2, Plus, Trash2, X } from "lucide-react"
import { useId, useMemo } from "react"

export type AllotmentEditorMode = "qc" | "field"

export function allotmentModeForRole(roleName: string): AllotmentEditorMode {
  return roleName === "QC_SUPERVISOR" ? "qc" : "field"
}

/** Sentinel in UI drafts for All Wards; stripped before API payload. */
export const ALL_WARDS_SENTINEL = "__ALL_WARDS__"

export type AllotmentDraft = {
  key: string
  stateId: string
  districtId: string
  ulbId: string
  /** Empty = incomplete; ALL_WARDS_SENTINEL = unrestricted; else ward id */
  wardId: string
}

type CityGroup = {
  key: string
  stateId: string
  districtId: string
  ulbId: string
  wardIds: string[]
  allWards: boolean
}

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function emptyAllotment(): AllotmentDraft {
  return {
    key: newKey(),
    stateId: "",
    districtId: "",
    ulbId: "",
    wardId: "",
  }
}

/** Complete when each city has geo + (All Wards or at least one ward). */
export function allotmentsComplete(rows: AllotmentDraft[], mode: AllotmentEditorMode = "field"): boolean {
  const groups = rowsToGroups(rows)
  if (!groups.length) return false
  if (mode === "qc" && groups.length !== 1) return false
  return groups.every((g) => {
    if (!g.stateId || !g.districtId || !g.ulbId) return false
    if (g.allWards) return true
    if (mode === "qc") return g.wardIds.length === 1
    return g.wardIds.length > 0
  })
}

export function toAllotmentPayload(rows: AllotmentDraft[]) {
  const groups = rowsToGroups(rows)
  const payload: Array<{
    stateId: string
    districtId: string
    ulbId: string
    wardId?: string
  }> = []

  for (const group of groups) {
    if (!group.stateId || !group.districtId || !group.ulbId) continue
    if (group.allWards) {
      payload.push({
        stateId: group.stateId,
        districtId: group.districtId,
        ulbId: group.ulbId,
      })
      continue
    }
    for (const wardId of group.wardIds) {
      if (!wardId || wardId === ALL_WARDS_SENTINEL) continue
      payload.push({
        stateId: group.stateId,
        districtId: group.districtId,
        ulbId: group.ulbId,
        wardId,
      })
    }
  }
  return payload
}

/** Stable compare for dirty tracking (ignores draft keys). */
export function allotmentsEqual(a: AllotmentDraft[], b: AllotmentDraft[]): boolean {
  const norm = (rows: AllotmentDraft[]) =>
    toAllotmentPayload(rows)
      .map((r) => `${r.stateId}|${r.districtId}|${r.ulbId}|${r.wardId ?? ""}`)
      .sort()
      .join(";")
  return norm(a) === norm(b)
}

export function countDistinctUlbs(rows: AllotmentDraft[]): number {
  return new Set(
    rowsToGroups(rows)
      .filter((g) => g.ulbId)
      .map((g) => g.ulbId)
  ).size
}

function wardLabel(ward: Pick<GeoWard, "wardNumber" | "wardName">) {
  return formatWardOptionLabel(ward)
}

function rowsToGroups(rows: AllotmentDraft[]): CityGroup[] {
  if (!rows.length) {
    return [{ key: newKey(), stateId: "", districtId: "", ulbId: "", wardIds: [], allWards: false }]
  }

  const groups: CityGroup[] = []
  const byUlb = new Map<string, CityGroup>()

  for (const row of rows) {
    if (!row.ulbId) {
      groups.push({
        key: row.key,
        stateId: row.stateId,
        districtId: row.districtId,
        ulbId: "",
        wardIds: [],
        allWards: false,
      })
      continue
    }

    const existing = byUlb.get(row.ulbId)
    if (existing) {
      if (row.wardId === ALL_WARDS_SENTINEL) {
        existing.allWards = true
        existing.wardIds = []
      } else if (row.wardId && !existing.allWards && !existing.wardIds.includes(row.wardId)) {
        existing.wardIds.push(row.wardId)
      }
    } else {
      const group: CityGroup = {
        key: row.key,
        stateId: row.stateId,
        districtId: row.districtId,
        ulbId: row.ulbId,
        wardIds: row.wardId && row.wardId !== ALL_WARDS_SENTINEL ? [row.wardId] : [],
        allWards: row.wardId === ALL_WARDS_SENTINEL,
      }
      byUlb.set(row.ulbId, group)
      groups.push(group)
    }
  }

  return groups.length
    ? groups
    : [{ key: newKey(), stateId: "", districtId: "", ulbId: "", wardIds: [], allWards: false }]
}

function groupsToRows(groups: CityGroup[]): AllotmentDraft[] {
  const rows: AllotmentDraft[] = []
  for (const group of groups) {
    if (group.allWards) {
      rows.push({
        key: group.key,
        stateId: group.stateId,
        districtId: group.districtId,
        ulbId: group.ulbId,
        wardId: ALL_WARDS_SENTINEL,
      })
      continue
    }
    if (!group.wardIds.length) {
      rows.push({
        key: group.key,
        stateId: group.stateId,
        districtId: group.districtId,
        ulbId: group.ulbId,
        wardId: "",
      })
      continue
    }
    for (const wardId of group.wardIds) {
      rows.push({
        key: `${group.key}-${wardId}`,
        stateId: group.stateId,
        districtId: group.districtId,
        ulbId: group.ulbId,
        wardId,
      })
    }
  }
  return rows.length ? rows : [emptyAllotment()]
}

function GeoLoadHint({
  isLoading,
  isError,
  empty,
  emptyMessage,
}: {
  isLoading: boolean
  isError: boolean
  empty: boolean
  emptyMessage: string
}) {
  if (isLoading) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Loading…
      </p>
    )
  }
  if (isError) {
    return <p className="text-xs text-destructive">Could not load list. Check permissions and try again.</p>
  }
  if (empty) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>
  }
  return null
}

function CityGroupEditor({
  group,
  index,
  mode,
  canRemove,
  takenWardIds,
  onChange,
  onRemove,
}: {
  group: CityGroup
  index: number
  mode: AllotmentEditorMode
  canRemove: boolean
  takenWardIds: Set<string>
  onChange: (next: CityGroup) => void
  onRemove: () => void
}) {
  const labelId = useId()
  const { data: states, isLoading: statesLoading, isError: statesError } = useStates({ limit: 100 })
  const {
    data: districts,
    isLoading: districtsLoading,
    isError: districtsError,
  } = useDistricts(group.stateId || undefined)
  const { data: ulbs, isLoading: ulbsLoading, isError: ulbsError } = useUlbs(group.districtId || undefined)
  const { data: wards, isLoading: wardsLoading, isError: wardsError } = useWards(group.ulbId || undefined)

  const stateItems = states?.items ?? []
  const districtItems = districts?.items ?? []
  const ulbItems = ulbs?.items ?? []
  const wardItems = wards?.items ?? []

  const selectedWardMeta = useMemo(() => {
    const map = new Map(wardItems.map((w) => [w.id, w]))
    return group.wardIds.map((id) => {
      const ward = map.get(id)
      return { id, label: ward ? wardLabel(ward) : id }
    })
  }, [group.wardIds, wardItems])

  const toggleWard = (wardId: string, checked: boolean) => {
    if (group.allWards) return
    if (checked) {
      if (takenWardIds.has(wardId) && !group.wardIds.includes(wardId)) return
      if (mode === "qc") {
        onChange({ ...group, wardIds: [wardId], allWards: false })
        return
      }
      onChange({ ...group, wardIds: [...group.wardIds, wardId], allWards: false })
      return
    }
    onChange({ ...group, wardIds: group.wardIds.filter((id) => id !== wardId) })
  }

  const setAllWards = (enabled: boolean) => {
    onChange({
      ...group,
      allWards: enabled,
      wardIds: enabled ? [] : group.wardIds,
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-muted/15 p-4">
      <div className="flex items-center justify-between gap-2">
        <p id={labelId} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {mode === "qc" ? "Location" : `City ${index + 1}`}
        </p>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 cursor-pointer rounded-lg text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remove city ${index + 1}`}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-labelledby={labelId}>
        <FormField label="State" required>
          <Select
            value={group.stateId || undefined}
            onValueChange={(value) =>
              onChange({ ...group, stateId: value, districtId: "", ulbId: "", wardIds: [], allWards: false })
            }
          >
            <SelectTrigger className="h-10 cursor-pointer rounded-xl">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {stateItems.map((state) => (
                <SelectItem key={state.id} value={state.id}>
                  {state.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <GeoLoadHint
            isLoading={statesLoading}
            isError={statesError}
            empty={!statesLoading && !statesError && stateItems.length === 0}
            emptyMessage="No states available."
          />
        </FormField>

        <FormField label="District" required>
          <Select
            value={group.districtId || undefined}
            onValueChange={(value) =>
              onChange({ ...group, districtId: value, ulbId: "", wardIds: [], allWards: false })
            }
            disabled={!group.stateId}
          >
            <SelectTrigger className="h-10 cursor-pointer rounded-xl">
              <SelectValue placeholder="Select district" />
            </SelectTrigger>
            <SelectContent>
              {districtItems.map((district) => (
                <SelectItem key={district.id} value={district.id}>
                  {district.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {group.stateId ? (
            <GeoLoadHint
              isLoading={districtsLoading}
              isError={districtsError}
              empty={!districtsLoading && !districtsError && districtItems.length === 0}
              emptyMessage="No districts for this state."
            />
          ) : null}
        </FormField>

        <FormField label="ULB" required className="sm:col-span-2">
          <Select
            value={group.ulbId || undefined}
            onValueChange={(value) => onChange({ ...group, ulbId: value, wardIds: [], allWards: false })}
            disabled={!group.districtId}
          >
            <SelectTrigger className="h-10 cursor-pointer rounded-xl">
              <SelectValue placeholder="Select ULB" />
            </SelectTrigger>
            <SelectContent>
              {ulbItems.map((ulb) => (
                <SelectItem key={ulb.id} value={ulb.id}>
                  {ulb.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {group.districtId ? (
            <GeoLoadHint
              isLoading={ulbsLoading}
              isError={ulbsError}
              empty={!ulbsLoading && !ulbsError && ulbItems.length === 0}
              emptyMessage="No ULBs for this district."
            />
          ) : null}
        </FormField>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-background/60 px-3 py-2.5">
          <div className="space-y-0.5">
            <Label htmlFor={`${labelId}-all-wards`} className="text-sm font-medium">
              All Wards
            </Label>
            <p className="text-xs text-muted-foreground">
              {mode === "qc"
                ? "Grant unrestricted access across every ward in this location."
                : "Unrestricted access for this city; cannot mix with specific wards."}
            </p>
          </div>
          <Switch
            id={`${labelId}-all-wards`}
            checked={group.allWards}
            disabled={!group.ulbId}
            onCheckedChange={setAllWards}
            className="cursor-pointer"
          />
        </div>

        {group.allWards ? (
          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Unrestricted Access
          </span>
        ) : (
          <>
            <p className="text-sm font-medium">
              {mode === "qc" ? "Ward" : "Wards"} <span className="text-destructive">*</span>
            </p>
            {!group.ulbId ? (
              <p className="text-xs text-muted-foreground">Select a ULB to choose wards.</p>
            ) : wardsLoading ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Loading wards…
              </p>
            ) : wardsError ? (
              <p className="text-xs text-destructive">Could not load wards. Check permissions and try again.</p>
            ) : wardItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No wards in master data for this ULB.</p>
            ) : (
              <div
                className="max-h-48 space-y-1 overflow-y-auto rounded-xl border bg-background/80 p-2"
                role="group"
                aria-label={mode === "qc" ? "Ward for location" : `Wards for city ${index + 1}`}
              >
                {wardItems.map((ward) => {
                  const checked = group.wardIds.includes(ward.id)
                  const takenElsewhere = takenWardIds.has(ward.id) && !checked
                  return (
                    <label
                      key={ward.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-200 hover:bg-muted/60",
                        takenElsewhere && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={takenElsewhere}
                        onCheckedChange={(value) => toggleWard(ward.id, value === true)}
                        aria-label={wardLabel(ward)}
                      />
                      <span>{wardLabel(ward)}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {selectedWardMeta.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5 pt-1">
                {selectedWardMeta.map((ward) => (
                  <li key={ward.id}>
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs transition-colors duration-200 hover:border-destructive/40 hover:text-destructive"
                      onClick={() => toggleWard(ward.id, false)}
                      aria-label={`Remove ${ward.label}`}
                    >
                      {ward.label}
                      <X className="size-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : group.ulbId && !wardsLoading && !wardsError ? (
              <p className="text-xs text-muted-foreground">
                {mode === "qc" ? "Select one ward, or enable All Wards." : "Select at least one ward."}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export function UserAllotmentsEditor({
  value,
  onChange,
  mode = "field",
}: {
  value: AllotmentDraft[]
  onChange: (next: AllotmentDraft[]) => void
  mode?: AllotmentEditorMode
}) {
  const groups = useMemo(() => {
    const next = rowsToGroups(value)
    if (mode === "qc" && next.length > 1) {
      return [next[0]!]
    }
    return next
  }, [value, mode])

  const takenWardIds = useMemo(() => {
    const set = new Set<string>()
    for (const row of value) {
      if (row.wardId) set.add(row.wardId)
    }
    return set
  }, [value])

  const updateGroups = (nextGroups: CityGroup[]) => {
    const limited = mode === "qc" ? nextGroups.slice(0, 1) : nextGroups
    onChange(groupsToRows(limited))
  }

  const multiUlbWarning = mode === "qc" && rowsToGroups(value).length > 1

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {mode === "qc"
          ? "Assign one Location (ULB), then choose a single ward or All Wards (Unrestricted Access)."
          : "Pick a city (State → District → ULB), then select wards or All Wards. Add another city to assign across ULBs."}
      </p>
      {multiUlbWarning ? (
        <p
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
          role="alert"
        >
          This QC Supervisor currently has multiple locations. Choose a single Location before saving.
        </p>
      ) : null}
      {groups.map((group, index) => (
        <CityGroupEditor
          key={group.key}
          group={group}
          index={index}
          mode={mode}
          canRemove={mode === "field" && groups.length > 1}
          takenWardIds={takenWardIds}
          onChange={(next) => updateGroups(groups.map((g) => (g.key === group.key ? next : g)))}
          onRemove={() => updateGroups(groups.filter((g) => g.key !== group.key))}
        />
      ))}
      {mode === "field" ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full cursor-pointer rounded-xl border-dashed"
          onClick={() =>
            updateGroups([
              ...groups,
              { key: newKey(), stateId: "", districtId: "", ulbId: "", wardIds: [], allWards: false },
            ])
          }
        >
          <Plus className="mr-2 size-4" />
          Add another city
        </Button>
      ) : null}
    </div>
  )
}

/** Resolved geography labels for confirm / review steps. */
export function AllotmentSummaryList({ allotments }: { allotments: AllotmentDraft[] }) {
  const groups = rowsToGroups(allotments).filter((g) => g.stateId && g.districtId && g.ulbId)
  const { data: states } = useStates({ limit: 100 })

  if (!groups.length) {
    return <p className="text-sm text-muted-foreground">No complete allotments yet.</p>
  }

  return (
    <ul className="mt-2 space-y-2 text-sm">
      {groups.map((group) => (
        <AllotmentSummaryGroup
          key={group.key}
          group={group}
          stateName={states?.items.find((s) => s.id === group.stateId)?.name}
        />
      ))}
    </ul>
  )
}

function AllotmentSummaryGroup({ group, stateName }: { group: CityGroup; stateName?: string }) {
  const { data: districts } = useDistricts(group.stateId || undefined)
  const { data: ulbs } = useUlbs(group.districtId || undefined)
  const { data: wards } = useWards(group.ulbId || undefined)

  const districtName = districts?.items.find((d) => d.id === group.districtId)?.name
  const ulbName = ulbs?.items.find((u) => u.id === group.ulbId)?.name

  const wardText = group.allWards
    ? "Unrestricted Access"
    : group.wardIds
        .map((id) => {
          const ward = wards?.items.find((w) => w.id === id)
          return ward ? wardLabel(ward) : id
        })
        .join(", ") || "Ward"

  return (
    <li className="rounded-xl border bg-background/60 px-3 py-2">
      <span className="font-medium">{ulbName ?? "ULB"}</span>
      <span className="text-muted-foreground"> · </span>
      <span>{wardText}</span>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {[stateName, districtName].filter(Boolean).join(" → ") || "—"}
      </p>
    </li>
  )
}
