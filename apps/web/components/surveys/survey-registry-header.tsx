"use client"

import { useDistricts, useStates, useUlbs, useWards } from "@/hooks/use-api"
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
import { MapPinned } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const DEFAULT_DISTRICT_NAME = "Baghpat"
const DEFAULT_ULB_HINT = "aminagar"
const DEFAULT_WARD_NUMBERS = new Set(["05", "5"])

export interface RegistryScopeState {
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
}

export const emptyScope = (): RegistryScopeState => ({
  stateId: "",
  districtId: "",
  ulbId: "",
  wardId: "",
})

export function SurveyRegistryHeader({
  scopeLabel,
  scope,
  onScopeChange,
}: {
  scopeLabel: string
  scope: RegistryScopeState
  onScopeChange: (next: RegistryScopeState) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(scope)
  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(open ? draft.stateId || undefined : scope.stateId || undefined)
  const { data: ulbs } = useUlbs(open ? draft.districtId || undefined : scope.districtId || undefined)
  const { data: wards } = useWards(open ? draft.ulbId || undefined : scope.ulbId || undefined)

  const defaultsApplied = useRef({ state: false, district: false, ulb: false, ward: false })

  useEffect(() => {
    if (defaultsApplied.current.state || scope.stateId || !(states?.items ?? []).length) return
    const first = states?.items?.[0]
    if (first) {
      defaultsApplied.current.state = true
      onScopeChange({ ...scope, stateId: first.id })
    }
  }, [scope, states?.items, onScopeChange])

  useEffect(() => {
    if (defaultsApplied.current.district || scope.districtId || !(districts?.items ?? []).length) return
    const match = (districts?.items ?? []).find((d) =>
      d.name.toLowerCase().includes(DEFAULT_DISTRICT_NAME.toLowerCase())
    )
    if (match) {
      defaultsApplied.current.district = true
      onScopeChange({ ...scope, districtId: match.id, ulbId: "", wardId: "" })
    }
  }, [districts?.items, scope, onScopeChange])

  useEffect(() => {
    if (defaultsApplied.current.ulb || !scope.districtId || scope.ulbId || !(ulbs?.items ?? []).length) return
    const match = (ulbs?.items ?? []).find((u) => u.name.toLowerCase().includes(DEFAULT_ULB_HINT))
    if (match) {
      defaultsApplied.current.ulb = true
      onScopeChange({ ...scope, ulbId: match.id, wardId: "" })
    }
  }, [ulbs?.items, scope, onScopeChange])

  useEffect(() => {
    if (defaultsApplied.current.ward || !scope.ulbId || scope.wardId || !(wards?.items ?? []).length) return
    const match = (wards?.items ?? []).find((w) => DEFAULT_WARD_NUMBERS.has(String(w.wardNumber)))
    if (match) {
      defaultsApplied.current.ward = true
      onScopeChange({ ...scope, wardId: match.id })
    }
  }, [wards?.items, scope, onScopeChange])

  function openScopeDialog() {
    setDraft(scope)
    setOpen(true)
  }

  return (
    <div className="space-y-4">
      <header>
        <span className="text-[10px] font-semibold tracking-[0.14em] text-rose-700 uppercase dark:text-rose-400">
          Field Surveys
        </span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">Survey Registry</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Search surveyors, filter records, and open field surveys across your assigned scope.
        </p>
      </header>

      <Card className="border-slate-100 shadow-sm dark:border-slate-800">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-violet-600 uppercase dark:text-violet-400">
              Active Survey Scope
            </p>
            <p className="mt-1 flex items-center gap-2 truncate text-sm font-medium text-foreground">
              <MapPinned className="size-4 shrink-0 text-indigo-500" />
              <span className="truncate">{scopeLabel || "Select district, ULB, and ward"}</span>
            </p>
          </div>
          <Button
            type="button"
            variant="link"
            className="h-auto cursor-pointer px-0 text-violet-600 dark:text-violet-400"
            onClick={openScopeDialog}
          >
            Change scope
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
            <DialogTitle>Change survey scope</DialogTitle>
            <DialogDescription>Choose district, municipality, and ward to filter the registry.</DialogDescription>
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
                  <SelectValue placeholder="Town Panchayat Aminagar Sarai" />
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
                  <SelectValue placeholder="Ward 05" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All wards</SelectItem>
                  {(wards?.items ?? []).map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.wardName || `Ward ${w.wardNumber}`}
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
              className="cursor-pointer bg-violet-600 text-white hover:bg-violet-700"
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
