"use client"

import { useDistricts, useStates, useUlbs, useWards } from "@/hooks/use-api"
import { formatWardOptionLabel } from "@/lib/format-ward-label"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { LayoutGrid, MapPin } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

const DEFAULT_DISTRICT_NAME = "Etah"
const DEFAULT_ULB_HINT = "etah"

export interface QcRegistryScopeState {
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
}

export const emptyQcScope = (): QcRegistryScopeState => ({
  stateId: "",
  districtId: "",
  ulbId: "",
  wardId: "",
})

/** Prefer a single active ward or single All-Wards ULB allotment over Etah soft-defaults. */
function allotmentScopeFromProfile(
  tenantRoles:
    | Array<{
        isActive: boolean
        stateId?: string | null
        districtId?: string | null
        ulbId?: string | null
        wardId?: string | null
      }>
    | undefined
): QcRegistryScopeState | null {
  const active = tenantRoles?.filter((r) => r.isActive) ?? []
  const withWard = active.filter((r) => Boolean(r.wardId))
  if (withWard.length === 1) {
    const r = withWard[0]!
    return {
      stateId: r.stateId ?? "",
      districtId: r.districtId ?? "",
      ulbId: r.ulbId ?? "",
      wardId: r.wardId ?? "",
    }
  }
  const ulbOnly = active.filter((r) => Boolean(r.ulbId) && !r.wardId)
  if (withWard.length === 0 && ulbOnly.length === 1) {
    const r = ulbOnly[0]!
    return {
      stateId: r.stateId ?? "",
      districtId: r.districtId ?? "",
      ulbId: r.ulbId ?? "",
      wardId: "",
    }
  }
  return null
}

export function QcRegistryHeader({
  scopeLabel,
  scope,
  onScopeChange,
}: {
  scopeLabel: string
  scope: QcRegistryScopeState
  onScopeChange: (next: QcRegistryScopeState) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(scope)
  const profile = useAuthStore((s) => s.profile)
  const allotmentDefaults = useMemo(() => allotmentScopeFromProfile(profile?.tenantRoles), [profile?.tenantRoles])

  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(open ? draft.stateId || undefined : scope.stateId || undefined)
  const { data: ulbs } = useUlbs(open ? draft.districtId || undefined : scope.districtId || undefined)
  const { data: wards } = useWards(open ? draft.ulbId || undefined : scope.ulbId || undefined)

  const defaultsApplied = useRef({ state: false, district: false, ulb: false, allotment: false })

  // Single-ward / single-ULB QC: seed scope from allotment so TenantGuard never sees parent-only geo.
  useEffect(() => {
    if (defaultsApplied.current.allotment || !allotmentDefaults) return
    if (scope.stateId || scope.districtId || scope.ulbId || scope.wardId) {
      defaultsApplied.current.allotment = true
      defaultsApplied.current.state = true
      defaultsApplied.current.district = true
      defaultsApplied.current.ulb = true
      return
    }
    defaultsApplied.current.allotment = true
    defaultsApplied.current.state = true
    defaultsApplied.current.district = true
    defaultsApplied.current.ulb = true
    onScopeChange(allotmentDefaults)
  }, [allotmentDefaults, scope, onScopeChange])

  useEffect(() => {
    if (allotmentDefaults || defaultsApplied.current.state || scope.stateId || !(states?.items ?? []).length) return
    const first = states?.items?.[0]
    if (first) {
      defaultsApplied.current.state = true
      onScopeChange({ ...scope, stateId: first.id })
    }
  }, [allotmentDefaults, scope, states?.items, onScopeChange])

  useEffect(() => {
    if (allotmentDefaults || defaultsApplied.current.district || scope.districtId || !(districts?.items ?? []).length)
      return
    const match = (districts?.items ?? []).find((d) =>
      d.name.toLowerCase().includes(DEFAULT_DISTRICT_NAME.toLowerCase())
    )
    if (match) {
      defaultsApplied.current.district = true
      onScopeChange({ ...scope, districtId: match.id, ulbId: "", wardId: "" })
    }
  }, [allotmentDefaults, districts?.items, scope, onScopeChange])

  useEffect(() => {
    if (
      allotmentDefaults ||
      defaultsApplied.current.ulb ||
      !scope.districtId ||
      scope.ulbId ||
      !(ulbs?.items ?? []).length
    )
      return
    const match = (ulbs?.items ?? []).find((u) => u.name.toLowerCase().includes(DEFAULT_ULB_HINT)) ?? ulbs?.items?.[0]
    if (match) {
      defaultsApplied.current.ulb = true
      onScopeChange({ ...scope, ulbId: match.id, wardId: "" })
    }
  }, [allotmentDefaults, ulbs?.items, scope, onScopeChange])

  function openScopeDialog() {
    setDraft(scope)
    setOpen(true)
  }

  return (
    <div className="space-y-4">
      <header>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-teal-700 uppercase dark:text-teal-400">
          <LayoutGrid className="size-3.5" />
          Quality Control
        </span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">QC Review Registry</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Search and open submitted surveys for verification, correction, and approval within your active ward.
        </p>
      </header>

      <Card className="border-teal-200/60 bg-card/80 shadow-sm backdrop-blur dark:border-teal-900/40">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-teal-700 uppercase dark:text-teal-400">
              Active QC Scope
            </p>
            <p className="mt-1 flex items-center gap-2 truncate text-sm font-semibold text-foreground">
              <MapPin className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />
              <span className="truncate">{scopeLabel || "Etah - Municipal Council Etah"}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Select district, ULB, and ward in Smart Filters to begin ward-wise QC.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 cursor-pointer border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-950/40"
            onClick={openScopeDialog}
          >
            Change ward
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft(scope)
          setOpen(next)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Change QC ward</DialogTitle>
            <DialogDescription>Choose district, municipality, and ward to filter the QC registry.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>State</Label>
              <Select
                value={draft.stateId || ""}
                onValueChange={(stateId) => setDraft({ stateId, districtId: "", ulbId: "", wardId: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {(states?.items ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>District</Label>
              <Select
                value={draft.districtId || ""}
                onValueChange={(districtId) => setDraft({ ...draft, districtId, ulbId: "", wardId: "" })}
                disabled={!draft.stateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={DEFAULT_DISTRICT_NAME} />
                </SelectTrigger>
                <SelectContent>
                  {(districts?.items ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ULB</Label>
              <Select
                value={draft.ulbId || ""}
                onValueChange={(ulbId) => setDraft({ ...draft, ulbId, wardId: "" })}
                disabled={!draft.districtId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Municipal Council Etah" />
                </SelectTrigger>
                <SelectContent>
                  {(ulbs?.items ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ward</Label>
              <Select
                value={draft.wardId || "all"}
                onValueChange={(value) => setDraft({ ...draft, wardId: value === "all" ? "" : value })}
                disabled={!draft.ulbId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All wards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All wards</SelectItem>
                  {(wards?.items ?? []).map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {formatWardOptionLabel(w)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer bg-teal-600 text-white hover:bg-teal-700"
              onClick={() => {
                onScopeChange(draft)
                setOpen(false)
              }}
            >
              Apply scope
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
